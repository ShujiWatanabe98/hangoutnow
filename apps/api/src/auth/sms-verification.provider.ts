import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

type TwilioVerifyResponse = { status?: string; code?: number };

@Injectable()
export class SmsVerificationProvider{
  private readonly logger = new Logger(SmsVerificationProvider.name);
  get enabled(){return Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_VERIFY_SERVICE_SID)}
  async request(phone:string){const data=await this.call('Verifications',{To:phone,Channel:'sms'});if(data.status!=='pending')throw new ServiceUnavailableException('SMS認証を開始できませんでした')}
  async check(phone:string,code:string){const data=await this.call('VerificationCheck',{To:phone,Code:code});return data.status==='approved'}
  private async call(resource:string,fields:Record<string,string>){const account=process.env.TWILIO_ACCOUNT_SID;const token=process.env.TWILIO_AUTH_TOKEN;const service=process.env.TWILIO_VERIFY_SERVICE_SID;if(!account||!token||!service)throw new ServiceUnavailableException('SMS認証は現在利用できません');const response=await fetch(`https://verify.twilio.com/v2/Services/${service}/${resource}`,{method:'POST',headers:{authorization:`Basic ${Buffer.from(`${account}:${token}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});const data=await response.json() as TwilioVerifyResponse;if(!response.ok){const code=typeof data.code==='number'?data.code:null;this.logger.warn(`Twilio Verify request failed: status=${response.status} code=${code??'unknown'}`);if(code===60200)throw new BadRequestException('携帯電話番号を確認してください');if(code===21608)throw new ServiceUnavailableException('SMS認証は現在準備中です。しばらくしてからお試しください');throw new ServiceUnavailableException('SMS認証に失敗しました。もう一度お試しください')}return data}
}
