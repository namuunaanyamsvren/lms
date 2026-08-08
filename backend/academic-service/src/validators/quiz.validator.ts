import { z } from 'zod';
export const id = z.object({ id: z.string().uuid() }).strict();
export const quizQuestionParams = z.object({ id: z.string().uuid(), questionId: z.string().uuid() }).strict();
export const attemptParams = z.object({ attemptId: z.string().uuid() }).strict();
export const answerParams = z.object({ attemptId: z.string().uuid(), questionId: z.string().uuid() }).strict();
export const listQuery = z.object({ moduleId: z.string().uuid().optional(), status: z.enum(['DRAFT','PUBLISHED','ARCHIVED']).optional() }).strict();
export const quizBody = z.object({
  moduleId: z.string().uuid(), title: z.string().trim().min(1).max(200), description: z.string().max(5000).optional().nullable(),
  timeLimitMins: z.number().int().min(1).max(1440).optional().nullable(), passingScore: z.number().min(0).max(100).default(70),
  status: z.enum(['DRAFT','PUBLISHED','ARCHIVED']).default('DRAFT'), availableFrom: z.coerce.date().optional().nullable(),
  availableUntil: z.coerce.date().optional().nullable(), maxAttempts: z.number().int().min(1).max(100).default(1),
  scoringPolicy: z.enum(['HIGHEST','LATEST']).default('LATEST'),
  shuffleQuestions: z.boolean().default(false), shuffleOptions: z.boolean().default(false), showResults: z.boolean().default(true),
  highStakes: z.boolean().default(false), proctoringConfigJson: z.string().max(10000).optional().nullable(),
}).strict().refine(x => !x.availableFrom || !x.availableUntil || x.availableFrom < x.availableUntil, { message:'availableUntil must be later', path:['availableUntil'] });
export const quizUpdate = z.object({
  title:z.string().trim().min(1).max(200).optional(),description:z.string().max(5000).optional().nullable(),
  timeLimitMins:z.number().int().min(1).max(1440).optional().nullable(),passingScore:z.number().min(0).max(100).optional(),
  status:z.enum(['DRAFT','PUBLISHED','ARCHIVED']).optional(),availableFrom:z.coerce.date().optional().nullable(),availableUntil:z.coerce.date().optional().nullable(),
  maxAttempts:z.number().int().min(1).max(100).optional(),scoringPolicy:z.enum(['HIGHEST','LATEST']).optional(),
  shuffleQuestions:z.boolean().optional(),shuffleOptions:z.boolean().optional(),
  showResults:z.boolean().optional(),highStakes:z.boolean().optional(),proctoringConfigJson:z.string().max(10000).optional().nullable(),
}).strict().refine(x => Object.keys(x).length > 0,'At least one field is required');
export const questionBody = z.object({
  text: z.string().trim().min(1).max(10000), type: z.enum(['MULTIPLE_CHOICE','MULTIPLE_SELECT','SINGLE_CHOICE','TRUE_FALSE','SHORT_ANSWER','ESSAY','TEXT']),
  options: z.array(z.object({ id:z.string().min(1).max(50), text:z.string().min(1).max(1000) }).strict()).max(20).default([]),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional().nullable(), points: z.number().positive().max(1000).default(1),
  explanation: z.string().max(5000).optional().nullable(), tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  difficulty: z.enum(['EASY','MEDIUM','HARD']).default('MEDIUM'), isBankQuestion: z.boolean().default(false),
}).strict();
export const questionUpdate = questionBody.partial().refine(x => Object.keys(x).length > 0, 'At least one field is required');
export const bankQuery = z.object({ search:z.string().trim().max(200).optional(), tag:z.string().trim().max(50).optional(), difficulty:z.enum(['EASY','MEDIUM','HARD']).optional(), type:z.enum(['MULTIPLE_CHOICE','MULTIPLE_SELECT','SINGLE_CHOICE','TRUE_FALSE','SHORT_ANSWER','ESSAY','TEXT']).optional() }).strict();
export const linkQuestion = z.object({ questionId:z.string().uuid() }).strict();
export const autosave = z.object({ answer: z.union([z.string().max(50000), z.array(z.string().max(1000)).max(100)]), clientTimestamp:z.coerce.date().optional() }).strict();
export const audit = z.object({ eventType:z.enum(['EXAM_OPENED','ANSWER_SAVED','RECONNECTED','FOCUS_LOST','FOCUS_GAINED','FULLSCREEN_EXIT','PROCTOR_SIGNAL']), metadata:z.record(z.unknown()).optional() }).strict();
export const grade = z.object({ score:z.number().min(0).max(1000), feedback:z.string().max(5000).optional().nullable() }).strict();
export const submit = z.object({ idempotencyKey:z.string().uuid().optional() }).strict();
