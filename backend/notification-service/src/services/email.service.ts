import nodemailer from 'nodemailer';
let transporter: nodemailer.Transporter | null = null;
export function validateEmailProviderConfiguration(){
 const production=process.env.NODE_ENV==='production';
 const required=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM'];
 const missing=required.filter(key=>!process.env[key]);
 if(production&&missing.length)throw new Error(`Notification SMTP configuration missing: ${missing.join(', ')}`);
}
const getTransporter=()=>{
 if(transporter)return transporter;
 if(!process.env.SMTP_HOST)return null;
 const port=Number(process.env.SMTP_PORT||587);
 transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:process.env.SMTP_SECURE==='true'||port===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},pool:true,maxConnections:Number(process.env.SMTP_MAX_CONNECTIONS||5)});
 return transporter;
};
export const sendEmail=async(to:string,subject:string,text:string,html?:string)=>{
 const client=getTransporter();if(!client){if(process.env.NODE_ENV==='production')throw new Error('SMTP is not configured');console.warn('[Notification] SMTP is not configured; email skipped');return {messageId:'development-skipped'};}
 const result=await client.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject,text,html});
 return {messageId:String(result.messageId)};
};
