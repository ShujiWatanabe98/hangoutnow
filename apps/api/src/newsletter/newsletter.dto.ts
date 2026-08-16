import { Equals, IsBoolean, IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsBoolean()
  @Equals(true)
  consent!: boolean;

  @IsString()
  @MaxLength(50)
  source!: string;
}

export class UnsubscribeNewsletterDto {
  @IsString()
  @Length(64, 64)
  token!: string;
}
