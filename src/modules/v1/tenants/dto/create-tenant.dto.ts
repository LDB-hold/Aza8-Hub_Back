import { IsEmail, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantAdminUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  packageKey!: string;

  @ValidateNested()
  @Type(() => CreateTenantAdminUserDto)
  adminUser!: CreateTenantAdminUserDto;
}

