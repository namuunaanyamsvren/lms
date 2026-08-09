import {describe,expect,it} from 'vitest';
import {audit,autosave,questionBody,quizBody,quizUpdate,submit} from '../academic-service/src/validators/quiz.validator';
describe('quiz/exam validation',()=>{
 it('supports objective and manually reviewed question types',()=>{
  for(const type of ['SINGLE_CHOICE','MULTIPLE_SELECT','TRUE_FALSE','SHORT_ANSWER','ESSAY'])expect(questionBody.parse({text:'Question',type,options:[],points:1}).type).toBe(type);
 });
 it('validates exam settings and protects structural fields',()=>{
  const q=quizBody.parse({moduleId:'11111111-1111-4111-8111-111111111111',title:'Final',passingScore:70,maxAttempts:2,highStakes:true});
  expect(q.status).toBe('DRAFT');expect(()=>quizUpdate.parse({moduleId:'22222222-2222-4222-8222-222222222222'})).toThrow();
 });
 it('accepts autosave arrays and allow-listed proctor audit events',()=>{
  expect(autosave.parse({answer:['a','b']}).answer).toEqual(['a','b']);
  expect(audit.parse({eventType:'RECONNECTED',metadata:{offlineSeconds:4}}).eventType).toBe('RECONNECTED');
 expect(()=>audit.parse({eventType:'ARBITRARY'})).toThrow();
  expect(()=>submit.parse({score:100,passed:true})).toThrow();
 });
});
