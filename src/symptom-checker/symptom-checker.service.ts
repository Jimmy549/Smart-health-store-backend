import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import { ProductsService } from '../products/products.service';
import { SymptomAnalysis } from '../schemas/symptom-analysis.schema';
import { SYMPTOM_MAPPING } from '../config/symptom-mapping';

@Injectable()
export class SymptomCheckerService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private productsService: ProductsService,
    @InjectModel(SymptomAnalysis.name) private symptomAnalysisModel: Model<SymptomAnalysis>,
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

  async analyzeSymptoms(symptoms: string, inputType: 'text' | 'voice' = 'text', userId: string = 'anonymous') {
    try {
      // Step 1: AI Analysis with Gemini
      const aiAnalysis = await this.getAIAnalysis(symptoms);
      
      // Step 2: Extract keywords and map to products
      const keywords = await this.extractKeywords(symptoms);
      const mappedProducts = this.mapSymptomsToProducts(keywords);
      
      // Step 3: Query MongoDB for matching products
      const products = await this.findMatchingProducts(mappedProducts);
      
      // Step 4: Calculate confidence and determine if follow-up needed
      const confidence = this.calculateConfidence(keywords, products);
      const followUpQuestion = confidence < 0.6 ? this.generateFollowUpQuestion(symptoms) : null;

      const result = {
        analysis: aiAnalysis,
        confidence,
        products: products.slice(0, 3).map(p => ({
          name: p.title,
          category: this.getCategoryFromTags(p.tags),
          price: p.price,
          image: p.image,
          description: p.description
        })),
        followUpQuestion
      };

      // Step 5: Store in MongoDB for analytics
      await this.symptomAnalysisModel.create({
        userId,
        symptoms,
        analysis: aiAnalysis,
        confidence,
        products: result.products,
        followUpQuestion,
        inputType
      });

      return result;
    } catch (error) {
      console.error('Symptom analysis error:', error);
      throw new Error('Failed to analyze symptoms');
    }
  }

  private async getAIAnalysis(symptoms: string): Promise<string> {
    const prompt = `You are a medical assistant (NOT a doctor) helping users understand their symptoms and suggesting wellness products.

User symptoms: "${symptoms}"

Provide a brief, helpful analysis that:
1. Acknowledges their symptoms with empathy
2. Explains what these symptoms are often linked to
3. Uses language like "often linked to", "may help with", "commonly used for"
4. Stays under 100 words
5. Does NOT diagnose diseases

Always end with: "This is not medical advice. Consult a healthcare professional for proper diagnosis."`;

    const response = await this.openai.chat.completions.create({
      model: this.configService.get<string>('GEMINI_MODEL'),
      messages: [
        {
          role: 'system',
          content: 'You are a helpful medical assistant. Provide supportive, non-diagnostic health information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content || 'Unable to analyze symptoms at this time.';
  }

  private async extractKeywords(symptoms: string): Promise<string[]> {
    try {
      const prompt = `Extract health-related keywords from: "${symptoms}"
      
Return only comma-separated keywords (3-5 max) that match health conditions, symptoms, or body parts.
Examples: tired → fatigue, energy, weak
joint pain → joint, pain, arthritis
hair loss → hair, weak, nutrition

Keywords:`;

      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('GEMINI_MODEL'),
        messages: [
          {
            role: 'system',
            content: 'Extract health keywords only. Return comma-separated list.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      });

      const keywordsText = response.choices[0]?.message?.content || '';
      return keywordsText
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);
    } catch (error) {
      console.error('Keyword extraction error:', error);
      return [];
    }
  }

  private mapSymptomsToProducts(keywords: string[]): string[] {
    const productNames = new Set<string>();
    
    keywords.forEach(keyword => {
      const mappedProducts = SYMPTOM_MAPPING[keyword];
      if (mappedProducts) {
        mappedProducts.forEach(product => productNames.add(product));
      }
    });

    return Array.from(productNames);
  }

  private async findMatchingProducts(productNames: string[]) {
    const allProducts = await this.productsService.getAllProducts();
    
    return allProducts.filter(product => 
      productNames.some(name => 
        product.title.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(product.title.toLowerCase())
      )
    );
  }

  private calculateConfidence(keywords: string[], products: any[]): number {
    if (keywords.length === 0) return 0.3;
    if (products.length === 0) return 0.4;
    
    const keywordScore = Math.min(keywords.length / 3, 1) * 0.4;
    const productScore = Math.min(products.length / 3, 1) * 0.6;
    
    return Math.round((keywordScore + productScore) * 100) / 100;
  }

  private generateFollowUpQuestion(symptoms: string): string {
    const questions = [
      "How long have you been experiencing these symptoms?",
      "Are these symptoms constant or do they come and go?",
      "Have you noticed any triggers that make these symptoms worse?",
      "Are you currently taking any medications or supplements?",
      "Do these symptoms affect your daily activities?"
    ];
    
    return questions[Math.floor(Math.random() * questions.length)];
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
}