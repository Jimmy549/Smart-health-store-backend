import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SymptomCheckerController } from './symptom-checker.controller';
import { SymptomCheckerService } from './symptom-checker.service';
import { SymptomAnalysis, SymptomAnalysisSchema } from '../schemas/symptom-analysis.schema';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SymptomAnalysis.name, schema: SymptomAnalysisSchema },
    ]),
    ProductsModule,
  ],
  controllers: [SymptomCheckerController],
  providers: [SymptomCheckerService],
  exports: [SymptomCheckerService],
})
export class SymptomCheckerModule {}