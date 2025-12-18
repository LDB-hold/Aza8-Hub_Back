import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SetGroupPermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  toolActionKeys!: string[];
}

