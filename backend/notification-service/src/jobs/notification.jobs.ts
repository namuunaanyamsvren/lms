import {cleanupRetention,processDueDeliveries} from '../services/notification.service';
let deliveryTimer:NodeJS.Timeout|undefined,cleanupTimer:NodeJS.Timeout|undefined;
export const startNotificationJobs=()=>{
 const poll=Number(process.env.NOTIFICATION_DELIVERY_POLL_MS||15000);
 deliveryTimer=setInterval(()=>processDueDeliveries().catch(e=>console.error('[Notification job] delivery failed',e)),poll);
 cleanupTimer=setInterval(()=>cleanupRetention().catch(e=>console.error('[Notification job] cleanup failed',e)),24*60*60*1000);
 deliveryTimer.unref();cleanupTimer.unref();
};
export const stopNotificationJobs=()=>{if(deliveryTimer)clearInterval(deliveryTimer);if(cleanupTimer)clearInterval(cleanupTimer);};
