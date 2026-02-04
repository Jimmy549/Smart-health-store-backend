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
        'HTTP-Referer': 'http://localhost:3001',
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
- When recommending products, mention relevant keywords like 'vitamin C', 'immune system', 'antioxidant' etc.
- DO NOT include specific product names, prices or details in your response
- Just mention that you're recommending products and they will be shown separately
- Keep responses very brief and concise (2-3 sentences maximum)
- Always prioritize user safety and health
- For serious medical conditions, advise consulting a doctor
- Be conversational and helpful`;

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
        max_tokens: 150,
      });

      const aiResponse = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      
      // Extract recommended products from AI response
      const recommendedProducts = this.extractRecommendedProducts(aiResponse, products);

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
        products: recommendedProducts,
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

  private extractRecommendedProducts(aiResponse: string, allProducts: any[]) {
    const recommendedProducts = [];
    const responseText = aiResponse.toLowerCase();
    
    // Check for specific product matches and related keywords
    for (const product of allProducts) {
      const productTitle = product.title.toLowerCase();
      const productTags = product.tags.map(tag => tag.toLowerCase());
      
      // Direct product name match
      if (responseText.includes(productTitle)) {
        recommendedProducts.push({
          name: product.title,
          category: this.getCategoryFromTags(product.tags),
          price: product.price,
          image: product.image,
          description: product.description
        });
        continue;
      }
      
      // Exact keyword matches only for specific ingredients
      const hasExactMatch = productTags.some(tag => {
        // Only match if the response specifically mentions the ingredient
        if (responseText.includes('vitamin c') && tag.includes('vitamin c')) return true;
        if (responseText.includes('zinc') && tag.includes('zinc')) return true;
        if (responseText.includes('iron') && tag.includes('iron')) return true;
        if (responseText.includes('calcium') && tag.includes('calcium')) return true;
        if (responseText.includes('omega') && tag.includes('omega')) return true;
        if (responseText.includes('probiotic') && tag.includes('probiotic')) return true;
        if (responseText.includes('melatonin') && tag.includes('melatonin')) return true;
        if (responseText.includes('magnesium') && tag.includes('magnesium')) return true;
        if (responseText.includes('collagen') && tag.includes('collagen')) return true;
        if (responseText.includes('turmeric') && tag.includes('turmeric')) return true;
        if (responseText.includes('immune') && tag.includes('immune')) return true;
        return false;
      });
      
      if (hasExactMatch) {
        recommendedProducts.push({
          name: product.title,
          category: this.getCategoryFromTags(product.tags),
          price: product.price,
          image: product.image,
          description: product.description
        });
      }
    }
    
    return recommendedProducts.slice(0, 3);
  }

  private getCategoryFromTags(tags: string[]): string {
    const categoryMap = {
      'vitamin': 'Vitamins',
      'mineral': 'Minerals', 
      'supplement': 'Supplements',
      'probiotic': 'Digestive Health',
      'omega': 'Heart Health',
      'joint': 'Joint Support',
      'sleep': 'Sleep Support',
      'immune': 'Immune Support'
    };

    for (const tag of tags) {
      for (const [key, category] of Object.entries(categoryMap)) {
        if (tag.toLowerCase().includes(key)) {
          return category;
        }
      }
    }
    
    return 'Health Supplements';
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