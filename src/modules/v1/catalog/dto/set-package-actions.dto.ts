import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SetPackageActionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  toolActionKeys!: string[];
}

