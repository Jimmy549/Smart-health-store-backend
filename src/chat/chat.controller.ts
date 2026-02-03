import { Controller, Post, Get, Body, Request } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @Body('message') message: string,
    @Body('inputType') inputType: 'text' | 'voice',
    @Request() req?: any,
  ) {
    if (!message || message.trim() === '') {
      return {
        success: false,
        message: 'Please provide a message',
      };
    }

    const userId = req?.user?.userId || 'anonymous';
    return this.chatService.chat(message, inputType || 'text', userId);
  }

  @Get('analytics')
  async getAnalytics() {
    return this.chatService.getAnalytics();
  }
}