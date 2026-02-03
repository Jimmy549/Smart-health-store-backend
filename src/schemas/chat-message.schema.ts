import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  response: string;

  @Prop({ enum: ['text', 'voice'], default: 'text' })
  inputType: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
