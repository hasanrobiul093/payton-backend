import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";


export class ChangePasswordDto {
    @ApiProperty({
        example: "pass123",
        description: "Old password",
    })
    @IsNotEmpty({ message: "Old password is required" })
    @IsString()
    oldPassword: string;

    @ApiProperty({
        example: "pass123",
        description: "New password",
    })
    @IsNotEmpty({ message: "New password is required" })
    @IsString()
    newPassword: string;
}