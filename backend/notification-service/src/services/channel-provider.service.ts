import { sendEmail } from './email.service';
export type DeliveryContent={recipient:string;subject:string;text:string;html:string;pushSubscriptions?:Array<{endpoint:string;p256dh:string;auth:string}>};

// SMS is opt-in per user (NotificationPreference.smsEnabled defaults to false),
// so unlike email this must not hard-require SMS_PROVIDER_URL to be set at all —
// many orgs will never use it. What it DOES catch: a half-entered config (URL
// set but token missing, or vice versa), which today only surfaces as a
// confusing 401/mismatched-auth failure the first time some user's SMS actually
// sends. Called at startup so that failure mode becomes an immediate, clear one.
export function validateSmsProviderConfiguration(){
 const url=process.env.SMS_PROVIDER_URL;
 const token=process.env.SMS_PROVIDER_TOKEN;
 if(!url&&!token)return;
 if(!url||!token)throw new Error('Notification SMS provider configuration is incomplete: both SMS_PROVIDER_URL and SMS_PROVIDER_TOKEN must be set together');
 if(process.env.NODE_ENV==='production'){
  let protocol:string;
  try{protocol=new URL(url).protocol;}catch{throw new Error('Notification SMS_PROVIDER_URL must be a valid URL');}
  if(protocol!=='https:')throw new Error('Notification SMS_PROVIDER_URL must use HTTPS in production');
 }
}
export async function sendChannel(channel:string,content:DeliveryContent){
 if(channel==='EMAIL')return {provider:'smtp',...(await sendEmail(content.recipient,content.subject,content.text,content.html))};
 if(channel==='SMS'){
  if(!process.env.SMS_PROVIDER_URL)throw new Error('SMS provider is not configured');
  const response=await fetch(process.env.SMS_PROVIDER_URL,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.SMS_PROVIDER_TOKEN||''}`},body:JSON.stringify({to:content.recipient,message:content.text})});
  if(!response.ok)throw new Error(`SMS provider returned ${response.status}`);
  const body:any=await response.json().catch(()=>({}));return {provider:process.env.SMS_PROVIDER||'http-sms',messageId:String(body.id||body.messageId||'accepted')};
 }
 if(channel==='PUSH'){
  if(!process.env.WEB_PUSH_PROVIDER_URL)throw new Error('Web Push provider is not configured');
  const response=await fetch(process.env.WEB_PUSH_PROVIDER_URL,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.WEB_PUSH_PROVIDER_TOKEN||''}`},body:JSON.stringify({subscriptions:content.pushSubscriptions,title:content.subject,body:content.text})});
  if(!response.ok)throw new Error(`Push provider returned ${response.status}`);return {provider:'web-push',messageId:response.headers.get('x-message-id')||'accepted'};
 }
 return {provider:'in-app',messageId:'stored'};
}
