import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

