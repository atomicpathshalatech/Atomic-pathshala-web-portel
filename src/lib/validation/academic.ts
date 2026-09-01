import { z } from 'zod';

export const CustomSubjectSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  name: z.string().min(1, 'Subject name is required').trim(),
  nameHindi: z.string().trim().optional(),
  code: z.string().trim().optional(),
});

export const CustomTopicSchema = z.object({
  chapterId: z.string().min(1, 'Chapter is required'),
  topicNumber: z.string().min(1, 'Topic number is required').trim(),
  title: z.string().min(1, 'Topic title is required').trim(),
  titleHindi: z.string().trim().optional(),
});

export const AcademicHierarchyQuerySchema = z.object({
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  chapterId: z.string().optional(),
  program: z.enum(['NEET', 'JEE_MAIN', 'JEE_ADVANCED', 'CBSE_BOARD', 'FOUNDATION']).optional(),
  lang: z.enum(['en', 'hi']).default('en'),
});

export type CustomSubjectInput = z.infer<typeof CustomSubjectSchema>;
export type CustomTopicInput = z.infer<typeof CustomTopicSchema>;
export type AcademicHierarchyQuery = z.infer<typeof AcademicHierarchyQuerySchema>;