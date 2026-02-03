import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import { ProductsService } from '../products/products.service';
import { ChatMessage } from '../schemas/chat-message.schema';

@Injectable()
export class ChatService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private productsService: ProductsService,
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessage>,
  ) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.configService.get<string>('OPENROUTER_API_KEY'),
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'Smart Health Store',
      },
    });
  }

  async chat(userMessage: string, inputType: 'text' | 'voice' = 'text', userId: string = 'anonymous') {
    try {
      // Get all products from database for context
      const products = await this.productsService.getAllProducts();

      // Create product context for AI
      const productContext = products
        .map(
          (p, index) =>
            `${index + 1}. ${p.title} - $${p.price}\n   Description: ${p.description}\n   Tags: ${p.tags.join(', ')}`,
        )
        .join('\n\n');

      const systemPrompt = `You are a helpful AI assistant for "Smart Health Store", an online healthcare and wellness store. Your role is to:

1. Answer health-related questions professionally and accurately
2. Recommend products from our store that match the user's needs
3. Provide health advice (but always remind users to consult healthcare professionals for serious issues)
4. Be friendly, empathetic, and supportive

Available Products in our store:
${productContext}

Guidelines:
- When recommending products, mention the product name and price
- Always prioritize user safety and health
- For serious medical conditions, advise consulting a doctor
- Be conversational and helpful
- Keep responses concise but informative`;

      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('GEMINI_MODEL'),
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const aiResponse = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      // Save chat message to database
      await this.chatMessageModel.create({
        userId,
        message: userMessage,
        response: aiResponse,
        inputType,
      });

      return {
        success: true,
        message: aiResponse,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Chat error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error. Please try again later.',
        error: error.message,
      };
    }
  }

  async getAnalytics() {
    const totalMessages = await this.chatMessageModel.countDocuments();
    const voiceCount = await this.chatMessageModel.countDocuments({ inputType: 'voice' });
    const textCount = await this.chatMessageModel.countDocuments({ inputType: 'text' });
    const voicePercentage = totalMessages > 0 ? Math.round((voiceCount / totalMessages) * 100) : 0;

    const recentVoiceQueries = await this.chatMessageModel
      .find({ inputType: 'voice' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('message createdAt')
      .exec();

    return {
      totalMessages,
      voiceCount,
      textCount,
      voicePercentage,
      recentVoiceQueries,
    };
  }
}