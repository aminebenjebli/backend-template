import {
    IsEmail,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
    @IsNotEmpty()
    @IsString()
    @IsEmail()
    @ApiProperty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty()
    otpCode: string;
    @IsOptional()
    @IsString()
    @IsIn(['verify', 'reset'])
    @ApiProperty({
        example: 'verify',
        enum: ['verify', 'reset'],
        default: 'verify',
        required: false,
        description:
            'Type of verification: verify for email verification, reset for password reset'
    })
    type?: 'verify' | 'reset' = 'verify';
}
