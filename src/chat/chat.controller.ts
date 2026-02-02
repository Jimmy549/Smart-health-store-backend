import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body('message') message: string) {
    if (!message || message.trim() === '') {
      return {
        success: false,
        message: 'Please provide a message',
      };
    }

    return this.chatService.chat(message);
  }
}