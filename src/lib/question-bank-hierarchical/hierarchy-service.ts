import { prisma } from "@/lib/db";
import {
  HierarchyNode,
  HierarchicalQuestionBankResponse,
  NodeCounts,
} from "./types";

const NEW_NODE_THRESHOLD_DAYS = 7;

/**
 * Normalizes taxonomy string for matching
 */
function normalizeTaxonomyString(str?: string | null): string {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Fetches the entire single-source-of-truth hierarchical question bank
 * with dynamically aggregated counts, NEW node indicators, and revision links.
 */
export async function getHierarchicalQuestionBank(
  userId?: string,
  searchQuery?: string,
  statusFilter?: "ALL" | "REVIEWED" | "DRAFT"
): Promise<HierarchicalQuestionBankResponse> {
  const sevenDaysAgo = new Date(Date.now() - NEW_NODE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  // 1. Fetch User Seen Nodes (for NEW indicator dismissal)
  const seenNodes = userId
    ? await prisma.revisionNodeSeen.findMany({
        where: { userId },
        select: { entityType: true, entityId: true },
      })
    : [];
  const seenSet = new Set(seenNodes.map((n) => `${n.entityType}_${n.entityId}`));

  // 2. Fetch User Active Revision Items
  const activeRevisionItems = userId
    ? await prisma.revisionItem.findMany({
        where: { userId, active: true },
        select: { id: true, entityType: true, entityId: true },
      })
    : [];
  const revisionMap = new Map(activeRevisionItems.map((r) => [`${r.entityType}_${r.entityId}`, r.id]));

  // 3. Fetch Full Academic Hierarchy from DB (Single Source of Truth)
  const academicClasses = await prisma.academicClass.findMany({
    where: { isActive: true },
    orderBy: { numericValue: "asc" },
    include: {
      subjects: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: {
          chapters: {
            where: { isActive: true },
            orderBy: [{ displayOrder: "asc" }, { chapterNumber: "asc" }],
            include: {
              topics: {
                where: { isActive: true },
                orderBy: { displayOrder: "asc" },
                include: {
                  subtopics: {
                    where: { isActive: true },
                    orderBy: { displayOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // 4. Fetch Question Aggregations directly from Database
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      subject: true,
      chapter: true,
      topic: true,
      subTopic: true,
      status: true,
      isPublished: true,
    },
  });

  // Build taxonomy-keyed question buckets for high-performance in-memory lookup
  // Key formats:
  // subjectKey = normalize(subject)
  // chapterKey = subjectKey + "||" + normalize(chapter)
  // topicKey = chapterKey + "||" + normalize(topic)
  // subtopicKey = topicKey + "||" + normalize(subTopic)
  const subtopicCounts = new Map<string, { reviewed: number; draft: number; total: number }>();
  const topicCounts = new Map<string, { reviewed: number; draft: number; total: number }>();
  const chapterCounts = new Map<string, { reviewed: number; draft: number; total: number }>();
  const subjectCounts = new Map<string, { reviewed: number; draft: number; total: number }>();

  for (const q of questions) {
    const isReviewed = q.isPublished || q.status === "PUBLISHED" || q.status === "APPROVED";
    const subKey = normalizeTaxonomyString(q.subject);
    const chapKey = subKey + "||" + normalizeTaxonomyString(q.chapter);
    const topKey = chapKey + "||" + normalizeTaxonomyString(q.topic);
    const subTopKey = topKey + "||" + normalizeTaxonomyString(q.subTopic);

    // Direct match buckets
    const addCount = (map: Map<string, { reviewed: number; draft: number; total: number }>, key: string) => {
      const current = map.get(key) || { reviewed: 0, draft: 0, total: 0 };
      current.total += 1;
      if (isReviewed) current.reviewed += 1;
      else current.draft += 1;
      map.set(key, current);
    };

    if (q.subject) addCount(subjectCounts, subKey);
    if (q.chapter) addCount(chapterCounts, chapKey);
    if (q.topic) addCount(topicCounts, topKey);
    if (q.subTopic) addCount(subtopicCounts, subTopKey);
  }

  // Helper to check if node is NEW
  const checkIsNew = (type: string, id: string, createdAt: Date): boolean => {
    if (createdAt < sevenDaysAgo) return false;
    return !seenSet.has(`${type}_${id}`);
  };

  let globalTotal = 0;
  let globalReviewed = 0;
  let globalDraft = 0;

  let totalClasses = academicClasses.length;
  let totalSubjects = 0;
  let totalChapters = 0;
  let totalTopics = 0;
  let totalSubtopics = 0;

  const breadcrumbsMap: Record<string, { id: string; name: string; level: HierarchyNode["level"] }[]> = {};

  // 5. Construct Hierarchy Tree with Bottom-Up Dynamic Aggregation
  const tree: HierarchyNode[] = academicClasses.map((cls) => {
    const classPath = cls.name;
    const classIsNew = checkIsNew("CLASS", cls.id, cls.createdAt);
    const classRevisionId = revisionMap.get(`CLASS_${cls.id}`);

    const classCounts: NodeCounts = { total: 0, reviewed: 0, draft: 0 };

    const subjectChildren: HierarchyNode[] = cls.subjects.map((sub) => {
      totalSubjects += 1;
      const subPath = `${classPath} / ${sub.name}`;
      const subIsNew = checkIsNew("SUBJECT", sub.id, sub.createdAt);
      const subRevisionId = revisionMap.get(`SUBJECT_${sub.id}`);

      const subCounts: NodeCounts = { total: 0, reviewed: 0, draft: 0 };

      const chapterChildren: HierarchyNode[] = sub.chapters.map((chap) => {
        totalChapters += 1;
        const chapPath = `${subPath} / ${chap.title}`;
        const chapIsNew = checkIsNew("CHAPTER", chap.id, chap.createdAt);
        const chapRevisionId = revisionMap.get(`CHAPTER_${chap.id}`);

        const chapCounts: NodeCounts = { total: 0, reviewed: 0, draft: 0 };

        // Direct chapter match if any
        const directChap = chapterCounts.get(
          normalizeTaxonomyString(sub.name) + "||" + normalizeTaxonomyString(chap.title)
        );

        const topicChildren: HierarchyNode[] = chap.topics.map((top) => {
          totalTopics += 1;
          const topPath = `${chapPath} / ${top.title}`;
          const topIsNew = checkIsNew("TOPIC", top.id, top.createdAt);
          const topRevisionId = revisionMap.get(`TOPIC_${top.id}`);

          const topCounts: NodeCounts = { total: 0, reviewed: 0, draft: 0 };

          // Direct topic match
          const directTop = topicCounts.get(
            normalizeTaxonomyString(sub.name) +
              "||" +
              normalizeTaxonomyString(chap.title) +
              "||" +
              normalizeTaxonomyString(top.title)
          );

          const subtopicChildren: HierarchyNode[] = top.subtopics.map((st) => {
            totalSubtopics += 1;
            const stPath = `${topPath} / ${st.title}`;
            const stIsNew = checkIsNew("SUBTOPIC", st.id, st.createdAt);
            const stRevisionId = revisionMap.get(`SUBTOPIC_${st.id}`);

            // Subtopic counts
            const directSt = subtopicCounts.get(
              normalizeTaxonomyString(sub.name) +
                "||" +
                normalizeTaxonomyString(chap.title) +
                "||" +
                normalizeTaxonomyString(top.title) +
                "||" +
                normalizeTaxonomyString(st.title)
            );

            const stCounts: NodeCounts = {
              total: directSt?.total || 0,
              reviewed: directSt?.reviewed || 0,
              draft: directSt?.draft || 0,
            };

            // Aggregate upward to topic
            topCounts.total += stCounts.total;
            topCounts.reviewed += stCounts.reviewed;
            topCounts.draft += stCounts.draft;

            const stNode: HierarchyNode = {
              id: st.id,
              key: `subtopic_${st.id}`,
              level: "SUBTOPIC",
              name: st.title,
              nameHindi: st.titleHindi,
              code: st.subtopicNumber,
              order: st.displayOrder,
              fullPath: stPath,
              pathIds: {
                classId: cls.id,
                subjectId: sub.id,
                chapterId: chap.id,
                topicId: top.id,
                subTopicId: st.id,
              },
              counts: stCounts,
              isNew: stIsNew,
              createdAt: st.createdAt.toISOString(),
              inRevision: Boolean(stRevisionId),
              revisionItemId: stRevisionId,
              isLeaf: true,
            };

            breadcrumbsMap[stNode.key] = [
              { id: cls.id, name: cls.name, level: "CLASS" },
              { id: sub.id, name: sub.name, level: "SUBJECT" },
              { id: chap.id, name: chap.title, level: "CHAPTER" },
              { id: top.id, name: top.title, level: "TOPIC" },
              { id: st.id, name: st.title, level: "SUBTOPIC" },
            ];

            return stNode;
          });

          // Add direct topic counts if not already covered by subtopics
          if (directTop && topCounts.total === 0) {
            topCounts.total += directTop.total;
            topCounts.reviewed += directTop.reviewed;
            topCounts.draft += directTop.draft;
          }

          // Aggregate upward to chapter
          chapCounts.total += topCounts.total;
          chapCounts.reviewed += topCounts.reviewed;
          chapCounts.draft += topCounts.draft;

          const topNode: HierarchyNode = {
            id: top.id,
            key: `topic_${top.id}`,
            level: "TOPIC",
            name: top.title,
            nameHindi: top.titleHindi,
            code: top.topicNumber,
            order: top.displayOrder,
            fullPath: topPath,
            pathIds: {
              classId: cls.id,
              subjectId: sub.id,
              chapterId: chap.id,
              topicId: top.id,
            },
            counts: topCounts,
            isNew: topIsNew,
            createdAt: top.createdAt.toISOString(),
            inRevision: Boolean(topRevisionId),
            revisionItemId: topRevisionId,
            children: subtopicChildren,
            isLeaf: subtopicChildren.length === 0,
          };

          breadcrumbsMap[topNode.key] = [
            { id: cls.id, name: cls.name, level: "CLASS" },
            { id: sub.id, name: sub.name, level: "SUBJECT" },
            { id: chap.id, name: chap.title, level: "CHAPTER" },
            { id: top.id, name: top.title, level: "TOPIC" },
          ];

          return topNode;
        });

        // Add direct chapter questions if any questions exist directly under chapter
        if (directChap && chapCounts.total === 0) {
          chapCounts.total += directChap.total;
          chapCounts.reviewed += directChap.reviewed;
          chapCounts.draft += directChap.draft;
        }

        // Aggregate upward to subject
        subCounts.total += chapCounts.total;
        subCounts.reviewed += chapCounts.reviewed;
        subCounts.draft += chapCounts.draft;

        const chapNode: HierarchyNode = {
          id: chap.id,
          key: `chapter_${chap.id}`,
          level: "CHAPTER",
          name: chap.title,
          nameHindi: chap.titleHindi,
          code: `CH-${chap.chapterNumber}`,
          order: chap.displayOrder,
          fullPath: chapPath,
          pathIds: {
            classId: cls.id,
            subjectId: sub.id,
            chapterId: chap.id,
          },
          counts: chapCounts,
          isNew: chapIsNew,
          createdAt: chap.createdAt.toISOString(),
          inRevision: Boolean(chapRevisionId),
          revisionItemId: chapRevisionId,
          children: topicChildren,
          isLeaf: topicChildren.length === 0,
        };

        breadcrumbsMap[chapNode.key] = [
          { id: cls.id, name: cls.name, level: "CLASS" },
          { id: sub.id, name: sub.name, level: "SUBJECT" },
          { id: chap.id, name: chap.title, level: "CHAPTER" },
        ];

        return chapNode;
      });

      // Aggregate upward to class
      classCounts.total += subCounts.total;
      classCounts.reviewed += subCounts.reviewed;
      classCounts.draft += subCounts.draft;

      const subNode: HierarchyNode = {
        id: sub.id,
        key: `subject_${sub.id}`,
        level: "SUBJECT",
        name: sub.name,
        nameHindi: sub.nameHindi,
        code: sub.code,
        order: sub.order,
        fullPath: subPath,
        pathIds: {
          classId: cls.id,
          subjectId: sub.id,
        },
        counts: subCounts,
        isNew: subIsNew,
        createdAt: sub.createdAt.toISOString(),
        inRevision: Boolean(subRevisionId),
        revisionItemId: subRevisionId,
        children: chapterChildren,
        isLeaf: chapterChildren.length === 0,
      };

      breadcrumbsMap[subNode.key] = [
        { id: cls.id, name: cls.name, level: "CLASS" },
        { id: sub.id, name: sub.name, level: "SUBJECT" },
      ];

      return subNode;
    });

    // Aggregate to global question bank
    globalTotal += classCounts.total;
    globalReviewed += classCounts.reviewed;
    globalDraft += classCounts.draft;

    const classNode: HierarchyNode = {
      id: cls.id,
      key: `class_${cls.id}`,
      level: "CLASS",
      name: cls.name,
      order: cls.order,
      fullPath: classPath,
      pathIds: {
        classId: cls.id,
      },
      counts: classCounts,
      isNew: classIsNew,
      createdAt: cls.createdAt.toISOString(),
      inRevision: Boolean(classRevisionId),
      revisionItemId: classRevisionId,
      children: subjectChildren,
      isLeaf: subjectChildren.length === 0,
    };

    breadcrumbsMap[classNode.key] = [{ id: cls.id, name: cls.name, level: "CLASS" }];

    return classNode;
  });

  // If questions exist without explicit Class links, include in total count
  if (globalTotal < questions.length) {
    const unaccountedTotal = questions.length - globalTotal;
    const unaccountedReviewed = questions.filter((q) => q.isPublished || q.status === "PUBLISHED").length - globalReviewed;
    globalTotal = questions.length;
    globalReviewed += Math.max(0, unaccountedReviewed);
    globalDraft = globalTotal - globalReviewed;
  }

  return {
    summary: {
      totalQuestions: globalTotal,
      reviewedQuestions: globalReviewed,
      draftQuestions: globalDraft,
      classesCount: totalClasses,
      subjectsCount: totalSubjects,
      chaptersCount: totalChapters,
      topicsCount: totalTopics,
      subtopicsCount: totalSubtopics,
    },
    tree,
    breadcrumbsMap,
  };
}

/**
 * Acknowledges a NEW node so the purple visual indicator disappears for this user
 */
export async function acknowledgeNodeSeen(userId: string, entityType: string, entityId: string) {
  return await prisma.revisionNodeSeen.upsert({
    where: {
      userId_entityType_entityId: {
        userId,
        entityType,
        entityId,
      },
    },
    create: {
      userId,
      entityType,
      entityId,
    },
    update: {
      seenAt: new Date(),
    },
  });
}
