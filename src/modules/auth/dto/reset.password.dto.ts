import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";


export class ResetPasswordDto {
    @ApiProperty({
        example: "123456",
        description: "OTP code",
    })
    @IsString()
    @IsNotEmpty({ message: "OTP is required" })
    otp: string;

    @ApiProperty({
        example: "[EMAIL_ADDRESS]",
        description: "Email address",
    })
    @IsEmail()
    @IsNotEmpty({ message: "Email is required" })
    email: string;

    @ApiProperty({
        example: "pass123",
        description: "New password",
    })
    @IsNotEmpty({ message: "New password is required" })
    @IsString()
    newPassword: string;
}