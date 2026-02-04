import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SymptomAnalysisDocument = SymptomAnalysis & Document;

@Schema({ timestamps: true })
export class SymptomAnalysis {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  symptoms: string;

  @Prop({ required: true })
  analysis: string;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ type: [Object] })
  products: Array<{
    name: string;
    category: string;
    price: number;
  }>;

  @Prop()
  followUpQuestion?: string;

  @Prop({ required: true, enum: ['text', 'voice'] })
  inputType: string;
}

export const SymptomAnalysisSchema = SchemaFactory.createForClass(SymptomAnalysis);