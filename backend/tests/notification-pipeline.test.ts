import {afterEach,describe,expect,it} from 'vitest';
import {notificationEventSchema} from '../notification-service/src/services/notification.service';
import {renderTemplateString} from '../notification-service/src/services/template.service';
import {validateEmailProviderConfiguration} from '../notification-service/src/services/email.service';
import {userCreatedPayload} from '../auth-service/src/services/auth-outbox.service';
const original={...process.env};
afterEach(()=>{process.env={...original};});
describe('notification delivery pipeline',()=>{
 it('requires an idempotency key and supports all delivery channels',()=>{
  const event=notificationEventSchema.parse({organizationId:'org',userId:'user',eventType:'GRADE_PUBLISHED',idempotencyKey:'grade:1:user',title:'Grade',body:'Published',channels:['IN_APP','EMAIL','PUSH','SMS']});
  expect(event.channels).toHaveLength(4);
  expect(()=>notificationEventSchema.parse({...event,idempotencyKey:''})).toThrow();
 });
 it('escapes variables in HTML templates while preserving text templates',()=>{
  expect(renderTemplateString('<p>{{name}}</p>',{name:'<script>x</script>'},true)).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
  expect(renderTemplateString('Hello {{name}}',{name:'Namuuna'})).toBe('Hello Namuuna');
 });
 it('fails fast when production SMTP secrets are incomplete',()=>{
  process.env.NODE_ENV='production';delete process.env.SMTP_HOST;delete process.env.SMTP_PASS;
  expect(()=>validateEmailProviderConfiguration()).toThrow(/SMTP_HOST/);
 });
 it('creates a complete welcome outbox payload in the auth transaction boundary',()=>{
  const payload=userCreatedPayload({id:'u1',organizationId:'o1',email:'user@example.com',role:'STUDENT',firstName:'User'});
  expect(payload).toMatchObject({userId:'u1',organizationId:'o1',email:'user@example.com',role:'STUDENT'});
  expect(payload.occurredAt).toBeTruthy();
 });
});
