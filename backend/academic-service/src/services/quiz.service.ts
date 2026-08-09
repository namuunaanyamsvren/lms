import { AppError } from '@lms/shared';
import { prisma } from '../lib/prisma';
type Actor={userId:string;role:string};
const admin=(r:string)=>['ORG_ADMIN','SUPER_ADMIN'].includes(r);
const editableCourse=(actor:Actor)=>admin(actor.role)?{}:{OR:[{instructorId:actor.userId},{instructors:{some:{userId:actor.userId}}}]};
const editorQuiz=async(org:string,id:string,actor:Actor)=>{
  const quiz=await prisma.quiz.findFirst({where:{id,organizationId:org,module:{course:editableCourse(actor)}}});
  if(!quiz) throw AppError.notFound('Quiz not found'); return quiz;
};
const serializeQuestion=(data:any)=>{const {options,correctAnswer,...rest}=data;return {...rest,optionsJson:JSON.stringify(options||[]),correctAnswer:correctAnswer==null?null:JSON.stringify(correctAnswer)}};
const publicQuestion=(q:any)=>{const {correctAnswer,explanation,optionsJson,...safe}=q;return {...safe,options:q.optionsJson?JSON.parse(q.optionsJson):[]};};
const audit=async(org:string,quizId:string,userId:string,eventType:string,attemptId?:string,metadata?:any)=>prisma.quizAuditEvent.create({data:{organizationId:org,quizId,userId,eventType,attemptId,metadataJson:metadata?JSON.stringify(metadata):null}});

export type AttemptQuestionSnapshot={id:string;text:string;type:string;options:Array<{id:string;text:string}>;correctAnswer:any;points:number;order:number};
const shuffled=<T>(values:T[])=>{const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
export const buildQuestionSnapshot=(quiz:any):AttemptQuestionSnapshot[]=>{
 let rows=quiz.questionLinks.map((link:any)=>{const q=link.question;let correctAnswer:any=null;try{correctAnswer=JSON.parse(q.correctAnswer||'null')}catch{correctAnswer=q.correctAnswer}let options=q.optionsJson?JSON.parse(q.optionsJson):[];if(quiz.shuffleOptions)options=shuffled(options);return {id:q.id,text:q.text,type:q.type,options,correctAnswer,points:link.pointsOverride??q.points,order:link.order};});
 if(quiz.shuffleQuestions)rows=shuffled(rows);return rows.map((q:any,index:number)=>({...q,order:index+1}));
};
// Pure so it's unit-testable without a DB: the hard deadline for an attempt is
// whichever comes first of (start + timeLimitMins) and the quiz's availableUntil window.
export const computeAttemptExpiry=(quiz:{timeLimitMins:number|null;availableUntil:Date|null},now:Date):Date|null=>{
 const limitExpiry=quiz.timeLimitMins?new Date(now.getTime()+quiz.timeLimitMins*60000):null;
 if(limitExpiry&&quiz.availableUntil)return limitExpiry<quiz.availableUntil?limitExpiry:quiz.availableUntil;
 return limitExpiry||quiz.availableUntil;
};
const parseSnapshot=(raw:string):AttemptQuestionSnapshot[]=>{try{return JSON.parse(raw)}catch{return []}};
const studentSnapshot=(raw:string)=>parseSnapshot(raw).map(({correctAnswer,...q})=>q);
// Post-submission review view: joins the immutable question snapshot with the
// student's saved answers/scores. Only called when the quiz allows result
// visibility (Quiz.showResults) — that flag already gates score/passed/answers
// together elsewhere (visibleAttempt), so per-question correctAnswer reveal follows it too.
type QuizAnswerRow={questionId:string;answerJson:string;score:number|null;isCorrect:boolean|null};
const reviewSnapshot=(raw:string,answers:QuizAnswerRow[])=>{
 const byQuestion=new Map(answers.map(a=>[a.questionId,a]));
 return parseSnapshot(raw).map(q=>{
  const a=byQuestion.get(q.id);
  let studentAnswer:any=null;
  if(a)try{studentAnswer=JSON.parse(a.answerJson)}catch{studentAnswer=null}
  return {...q,studentAnswer,score:a?.score??null,isCorrect:a?.isCorrect??null};
 });
};
export const scoreSnapshot=(questions:AttemptQuestionSnapshot[],answers:Map<string,any>)=>{let earned=0,total=0,manual=false;const scores=new Map<string,number|null>();for(const q of questions){total+=q.points;const score=answers.has(q.id)?autoScore(q,answers.get(q.id)):(['ESSAY','TEXT'].includes(q.type)?null:0);scores.set(q.id,score);if(score===null)manual=true;else earned+=score;}return {earned,total,manual,percent:total?earned/total*100:0,scores};};
const visibleAttempt=(a:any,showResults:boolean)=>{const {questionSnapshotJson,...withoutKey}=a;if(showResults)return withoutKey;const {score,passed,answers,...safe}=withoutKey;return {...safe,score:null,passed:null};};

export const list=async(org:string,actor:Actor,query:any)=>{
 const where:any={organizationId:org,...(query.moduleId?{moduleId:query.moduleId}:{}),...(query.status?{status:query.status}:{})};
 if(actor.role==='STUDENT'){where.status='PUBLISHED';where.module={course:{cohorts:{some:{enrollments:{some:{userId:actor.userId}}}}}};}
 else if(actor.role==='INSTRUCTOR') where.module={course:editableCourse(actor)};
 return prisma.quiz.findMany({where,include:{_count:{select:{questionLinks:true,quizAttempts:true}},module:{include:{course:{select:{id:true,title:true}}}}},orderBy:{updatedAt:'desc'}});
};
export const get=async(org:string,id:string,actor:Actor)=>{
 if(actor.role==='STUDENT'){
  const quiz=await prisma.quiz.findFirst({where:{id,organizationId:org,status:'PUBLISHED',module:{course:{cohorts:{some:{enrollments:{some:{userId:actor.userId}}}}}}}});
  if(!quiz)throw AppError.notFound('Quiz not found'); return quiz;
 }
 await editorQuiz(org,id,actor);
 return prisma.quiz.findUnique({where:{id},include:{questionLinks:{orderBy:{order:'asc'},include:{question:true}},quizAttempts:{include:{student:{select:{id:true,firstName:true,lastName:true}},answers:{include:{question:true}}},orderBy:{startedAt:'desc'}}}});
};
export const create=async(org:string,actor:Actor,data:any)=>{
 const mod=await prisma.module.findFirst({where:{id:data.moduleId,organizationId:org,course:editableCourse(actor)}});if(!mod)throw AppError.notFound('Module not found');
 return prisma.quiz.create({data:{...data,organizationId:org}});
};
export const update=async(org:string,id:string,actor:Actor,data:any)=>{await editorQuiz(org,id,actor);return prisma.quiz.update({where:{id},data});};
export const remove=async(org:string,id:string,actor:Actor)=>{await editorQuiz(org,id,actor);await prisma.quiz.delete({where:{id}});};
export const bank=async(org:string,actor:Actor,q:any)=>{
 if(!['INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'].includes(actor.role))throw AppError.forbidden();
 return prisma.question.findMany({where:{organizationId:org,isBankQuestion:true,...(q.search?{text:{contains:q.search,mode:'insensitive'}}:{}),...(q.tag?{tags:{has:q.tag}}:{}),...(q.difficulty?{difficulty:q.difficulty}:{}),...(q.type?{type:q.type}:{})},orderBy:{updatedAt:'desc'}});
};
export const createQuestion=async(org:string,quizId:string,actor:Actor,data:any)=>{
 await editorQuiz(org,quizId,actor);const order=await prisma.quizQuestion.count({where:{organizationId:org,quizId}});
 return prisma.$transaction(async tx=>{const question=await tx.question.create({data:{...serializeQuestion(data),organizationId:org,quizId,isBankQuestion:data.isBankQuestion,order:order+1}});await tx.quizQuestion.create({data:{organizationId:org,quizId,questionId:question.id,order:order+1}});return question;});
};
export const updateQuestion=async(org:string,id:string,actor:Actor,data:any)=>{
 const q=await prisma.question.findFirst({where:{id,organizationId:org,OR:[{quiz:{module:{course:editableCourse(actor)}}},{quizLinks:{some:{quiz:{module:{course:editableCourse(actor)}}}}}]}});if(!q)throw AppError.notFound('Question not found');
 return prisma.question.update({where:{id},data:serializeQuestion(data)});
};
export const deleteQuestion=async(org:string,id:string,actor:Actor)=>{await updateQuestion(org,id,actor,{});const used=await prisma.quizAnswer.count({where:{organizationId:org,questionId:id}});if(used)throw AppError.conflict('Answered questions cannot be deleted; unlink them from the quiz instead');await prisma.question.delete({where:{id}});};
export const linkBankQuestion=async(org:string,quizId:string,actor:Actor,questionId:string)=>{
 await editorQuiz(org,quizId,actor);const q=await prisma.question.findFirst({where:{id:questionId,organizationId:org,isBankQuestion:true}});if(!q)throw AppError.notFound('Bank question not found');
 const order=await prisma.quizQuestion.count({where:{organizationId:org,quizId}});return prisma.quizQuestion.create({data:{organizationId:org,quizId,questionId,order:order+1}});
};
export const unlinkQuestion=async(org:string,quizId:string,actor:Actor,questionId:string)=>{await editorQuiz(org,quizId,actor);await prisma.quizQuestion.deleteMany({where:{organizationId:org,quizId,questionId}});};
export const start=async(org:string,quizId:string,userId:string)=>{
 const now=new Date();const quiz=await prisma.quiz.findFirst({where:{id:quizId,organizationId:org,status:'PUBLISHED',AND:[{OR:[{availableFrom:null},{availableFrom:{lte:now}}]},{OR:[{availableUntil:null},{availableUntil:{gte:now}}]}],module:{course:{cohorts:{some:{enrollments:{some:{userId}}}}}}},include:{questionLinks:{orderBy:{order:'asc'},include:{question:true}}}});
 if(!quiz)throw AppError.notFound('Quiz is not available');if(!quiz.questionLinks.length)throw AppError.conflict('Quiz has no questions');
 const snapshot=buildQuestionSnapshot(quiz);
 const expiresAt=computeAttemptExpiry(quiz,now);
 const attempt=await prisma.$transaction(async tx=>{const existing=await tx.quizAttempt.findFirst({where:{organizationId:org,quizId,studentId:userId,status:'IN_PROGRESS'},include:{answers:true}});if(existing)return existing;const count=await tx.quizAttempt.count({where:{organizationId:org,quizId,studentId:userId}});if(count>=quiz.maxAttempts)throw AppError.conflict('Maximum attempts reached');return tx.quizAttempt.create({data:{organizationId:org,quizId,studentId:userId,attemptNumber:count+1,questionSnapshotJson:JSON.stringify(snapshot),expiresAt}});},{isolationLevel:'Serializable'});
 await audit(org,quizId,userId,'EXAM_OPENED',attempt.id);return visibleAttempt(attempt,false);
};
const studentAttempt=async(org:string,id:string,userId:string)=>{const a=await prisma.quizAttempt.findFirst({where:{id,organizationId:org,studentId:userId},include:{quiz:true,answers:true}});if(!a)throw AppError.notFound('Attempt not found');return a;};
export const resume=async(org:string,id:string,userId:string)=>{
 let a=await studentAttempt(org,id,userId);
 if(a.status==='IN_PROGRESS'&&a.expiresAt&&a.expiresAt<=new Date()){await finalizeAttempt(org,id,userId,true);a=await studentAttempt(org,id,userId);}
 const {questionSnapshotJson,...attempt}=a;
 const inProgress=a.status==='IN_PROGRESS';
 const showResults=a.quiz.showResults;
 const questions=inProgress?studentSnapshot(questionSnapshotJson):showResults?reviewSnapshot(questionSnapshotJson,a.answers):[];
 return {...visibleAttempt(attempt,showResults||inProgress),quiz:{...a.quiz,questions}};
};
export const saveAnswer=async(org:string,attemptId:string,questionId:string,userId:string,answer:any)=>{
 const a=await studentAttempt(org,attemptId,userId);if(a.status!=='IN_PROGRESS')throw AppError.conflict('Attempt is not editable');if(a.expiresAt&&a.expiresAt<=new Date()){await finalizeAttempt(org,attemptId,userId,true);throw AppError.conflict('Attempt has expired and was automatically submitted');}
 if(!parseSnapshot(a.questionSnapshotJson).some(x=>x.id===questionId))throw AppError.badRequest('Question is not part of attempt');
 const row=await prisma.quizAnswer.upsert({where:{organizationId_attemptId_questionId:{organizationId:org,attemptId,questionId}},create:{organizationId:org,attemptId,questionId,answerJson:JSON.stringify(answer)},update:{answerJson:JSON.stringify(answer),savedAt:new Date()}});
 await prisma.quizAttempt.update({where:{id:attemptId},data:{lastSavedAt:new Date()}});return row;
};
const autoScore=(q:any,answer:any)=>{if(['ESSAY','TEXT'].includes(q.type))return null;let expected:any;try{expected=typeof q.correctAnswer==='string'?JSON.parse(q.correctAnswer||'null'):q.correctAnswer}catch{expected=q.correctAnswer}const norm=(x:any)=>Array.isArray(x)?[...x].map(String).sort():String(x??'').trim().toLowerCase();return JSON.stringify(norm(answer))===JSON.stringify(norm(expected))?q.points:0;};
const finalizeAttempt=async(org:string,id:string,userId:string,expired=false)=>prisma.$transaction(async tx=>{const a=await tx.quizAttempt.findFirst({where:{id,organizationId:org,studentId:userId},include:{quiz:true,answers:true}});if(!a)throw AppError.notFound('Attempt not found');if(a.status!=='IN_PROGRESS')return visibleAttempt(a,a.quiz.showResults);const questions=parseSnapshot(a.questionSnapshotJson);const answerValues=new Map(a.answers.map(x=>{let value:any;try{value=JSON.parse(x.answerJson)}catch{value=null}return [x.questionId,value]}));const scored=scoreSnapshot(questions,answerValues);for(const answer of a.answers){const score=scored.scores.get(answer.questionId);if(score!==undefined&&score!==null)await tx.quizAnswer.update({where:{id:answer.id},data:{score,isCorrect:score===questions.find(q=>q.id===answer.questionId)?.points,gradedAt:new Date()}});}const now=new Date();const status=scored.manual?'UNDER_REVIEW':'GRADED';const result=await tx.quizAttempt.updateMany({where:{id,status:'IN_PROGRESS'},data:{score:scored.percent,passed:scored.manual?null:scored.percent>=a.quiz.passingScore,status,submittedAt:now,completedAt:now,gradedAt:scored.manual?null:now}});if(!result.count){const current=await tx.quizAttempt.findUniqueOrThrow({where:{id}});return visibleAttempt(current,a.quiz.showResults);}await tx.quizAuditEvent.create({data:{organizationId:org,quizId:a.quizId,userId,eventType:expired?'AUTO_SUBMITTED_EXPIRED':'SUBMITTED',attemptId:id,metadataJson:JSON.stringify({status})}});const current=await tx.quizAttempt.findUniqueOrThrow({where:{id}});return visibleAttempt(current,a.quiz.showResults);});
export const submit=async(org:string,id:string,userId:string)=>finalizeAttempt(org,id,userId,false);
export const expireDueAttempts=async(limit=100)=>{const due=await prisma.quizAttempt.findMany({where:{status:'IN_PROGRESS',expiresAt:{lte:new Date()}},select:{id:true,organizationId:true,studentId:true},take:limit,orderBy:{expiresAt:'asc'}});for(const a of due)await finalizeAttempt(a.organizationId,a.id,a.studentId,true);return due.length;};
export const history=async(org:string,quizId:string,userId:string)=>{const q=await prisma.quiz.findFirst({where:{id:quizId,organizationId:org,status:'PUBLISHED',module:{course:{cohorts:{some:{enrollments:{some:{userId}}}}}}},select:{showResults:true}});if(!q)throw AppError.notFound('Quiz not found');const attempts=await prisma.quizAttempt.findMany({where:{organizationId:org,quizId,studentId:userId},include:{answers:q.showResults},orderBy:{attemptNumber:'desc'}});return attempts.map(a=>visibleAttempt(a,q.showResults));};
export const gradeAnswer=async(org:string,attemptId:string,questionId:string,actor:Actor,data:any)=>{
 const a=await prisma.quizAttempt.findFirst({where:{id:attemptId,organizationId:org,quiz:{module:{course:editableCourse(actor)}}},include:{answers:true,quiz:true}});if(!a)throw AppError.notFound('Attempt not found');
 const answer=a.answers.find(x=>x.questionId===questionId);if(!answer)throw AppError.notFound('Answer not found');const snapshot=parseSnapshot(a.questionSnapshotJson);const question=snapshot.find(x=>x.id===questionId);if(!question)throw AppError.notFound('Attempt question not found');if(!['ESSAY','TEXT'].includes(question.type))throw AppError.badRequest('Question is automatically graded');if(data.score>question.points)throw AppError.badRequest('Score exceeds question points');
 await prisma.quizAnswer.update({where:{id:answer.id},data:{score:data.score,feedback:data.feedback,manuallyGraded:true,gradedAt:new Date()}});
 const refreshed=await prisma.quizAnswer.findMany({where:{attemptId:a.id}});const total=snapshot.reduce((s,x)=>s+x.points,0);const earned=refreshed.reduce((s,x)=>s+(x.score||0),0);const pct=total?earned/total*100:0;
 const pending=snapshot.some(q=>['ESSAY','TEXT'].includes(q.type)&&!refreshed.some(x=>x.questionId===q.id&&x.score!==null));
 return prisma.quizAttempt.update({where:{id:a.id},data:{score:pct,passed:pending?null:pct>=a.quiz.passingScore,status:pending?'UNDER_REVIEW':'GRADED',gradedAt:pending?null:new Date(),reviewedById:actor.userId}});
};
export const analytics=async(org:string,quizId:string,actor:Actor)=>{
 await editorQuiz(org,quizId,actor);const attempts=await prisma.quizAttempt.findMany({where:{organizationId:org,quizId,status:{in:['SUBMITTED','UNDER_REVIEW','GRADED']}},include:{answers:true}});const links=await prisma.quizQuestion.findMany({where:{organizationId:org,quizId},include:{question:true},orderBy:{order:'asc'}});
 const scores=attempts.map(a=>a.score||0);return {attempts:attempts.length,averageScore:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,passRate:scores.length?attempts.filter(a=>a.passed).length/scores.length*100:0,items:links.map(l=>{const answers=attempts.flatMap(a=>a.answers.filter(x=>x.questionId===l.questionId));return {questionId:l.questionId,text:l.question.text,responses:answers.length,correctRate:answers.length?answers.filter(x=>x.isCorrect).length/answers.length*100:0,averagePoints:answers.length?answers.reduce((s,x)=>s+(x.score||0),0)/answers.length:0};})};
};
export const recordAudit=async(org:string,attemptId:string,userId:string,eventType:string,metadata:any)=>{const a=await studentAttempt(org,attemptId,userId);return audit(org,a.quizId,userId,eventType,attemptId,metadata);};
