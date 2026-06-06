import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";


export class ForgetPasswordDto {
    @ApiProperty({
        example: "[EMAIL_ADDRESS]",
        description: "Email address",
    })
    @IsEmail()
    @IsNotEmpty({ message: "Email is required" })
    email: string;
}
