import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class SmsVerificationProvider{
  get enabled(){return Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_VERIFY_SERVICE_SID)}
  async request(phone:string){const data=await this.call('Verifications',{To:phone,Channel:'sms'});if(data.status!=='pending')throw new ServiceUnavailableException('SMS verification could not be started')}
  async check(phone:string,code:string){const data=await this.call('VerificationCheck',{To:phone,Code:code});return data.status==='approved'}
  private async call(resource:string,fields:Record<string,string>){const account=process.env.TWILIO_ACCOUNT_SID;const token=process.env.TWILIO_AUTH_TOKEN;const service=process.env.TWILIO_VERIFY_SERVICE_SID;if(!account||!token||!service)throw new ServiceUnavailableException('SMS provider is not configured');const response=await fetch(`https://verify.twilio.com/v2/Services/${service}/${resource}`,{method:'POST',headers:{authorization:`Basic ${Buffer.from(`${account}:${token}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});const data=await response.json() as {status?:string;message?:string};if(!response.ok)throw new ServiceUnavailableException(data.message||'SMS provider error');return data}
}
