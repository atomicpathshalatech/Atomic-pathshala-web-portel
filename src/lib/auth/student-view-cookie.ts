/**
 * Team ⇄ Student switch. A team member with the "student.view_as" permission
 * can open the student portal without signing in again; while they do, this
 * cookie is set. Kept in its own file because middleware (edge) reads it.
 *
 * The cookie alone grants nothing: every server check also requires the
 * permission (see canUseStudentPortal in ./student-view.ts).
 */
export const STUDENT_VIEW_COOKIE = "ap_student_view";
