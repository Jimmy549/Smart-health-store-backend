import { Controller, Post, Body, Request } from '@nestjs/common';
import { SymptomCheckerService } from './symptom-checker.service';

@Controller('symptom-checker')
export class SymptomCheckerController {
  constructor(private readonly symptomCheckerService: SymptomCheckerService) {}

  @Post()
  async analyzeSymptoms(
    @Body('symptoms') symptoms: string,
    @Body('inputType') inputType: 'text' | 'voice',
    @Request() req?: any,
  ) {
    if (!symptoms || symptoms.trim() === '') {
      return {
        success: false,
        message: 'Please provide symptoms to analyze',
      };
    }

    try {
      const userId = req?.user?.userId || 'anonymous';
      const result = await this.symptomCheckerService.analyzeSymptoms(
        symptoms,
        inputType || 'text',
        userId
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to analyze symptoms. Please try again.',
        error: error.message,
      };
    }
  }
}