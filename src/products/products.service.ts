import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Product, ProductDocument } from '../schemas/product.schema';

@Injectable()
export class ProductsService {
  private openai: OpenAI;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private configService: ConfigService,
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

  async createProduct(productData: any) {
    const product = await this.productModel.create(productData);
    return product;
  }

  async getAllProducts() {
    return this.productModel.find();
  }

  async searchProducts(query: string, searchType: 'normal' | 'ai' = 'normal') {
    if (!query || query.trim() === '') {
      return this.getAllProducts();
    }

    if (searchType === 'normal') {
      // Normal regex search on title
      return this.productModel.find({
        title: { $regex: query, $options: 'i' },
      });
    } else {
      // AI Intent Search
      const keywords = await this.extractKeywordsWithAI(query);
      
      if (keywords.length === 0) {
        return this.productModel.find({
          title: { $regex: query, $options: 'i' },
        });
      }

      // Search products by tags matching extracted keywords
      return this.productModel.find({
        tags: { $in: keywords.map(k => new RegExp(k, 'i')) },
      });
    }
  }

  private async extractKeywordsWithAI(userQuery: string): Promise<string[]> {
    try {
      // First, check for direct product name matches or common misspellings
      const directMatches = this.getDirectMatches(userQuery);
      if (directMatches.length > 0) {
        console.log('Direct matches found:', directMatches);
        return directMatches;
      }

      const prompt = `Extract health supplement keywords from: "${userQuery}"

Common supplements and their keywords:
- Zinc/Zink → zinc, immune, minerals
- Vitamin C → vitamin c, immune, antioxidant
- Iron → iron, anemia, energy, blood
- Calcium → calcium, bone health, bones
- Magnesium → magnesium, muscle, sleep
- Omega-3 → omega-3, heart health, brain
- Probiotics → probiotics, digestive health, gut
- Collagen → collagen, skin health, anti-aging

Return only relevant keywords (max 3) that match actual supplement names or health benefits.
Keywords:`;

      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('GEMINI_MODEL'),
        messages: [
          {
            role: 'system',
            content: 'Extract supplement keywords only. Return comma-separated list.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 50,
      });

      const keywordsText = response.choices[0]?.message?.content || '';
      const keywords = keywordsText
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

      console.log('Extracted keywords:', keywords);
      return keywords;
    } catch (error) {
      console.error('Error extracting keywords with AI:', error);
      return [];
    }
  }

  private getDirectMatches(query: string): string[] {
    const queryLower = query.toLowerCase().trim();
    
    // Handle common misspellings and direct matches
    const directMappings = {
      'zink': ['zinc'],
      'zinc': ['zinc'],
      'vitamin c': ['vitamin c'],
      'iron': ['iron'],
      'calcium': ['calcium'],
      'magnesium': ['magnesium'],
      'omega': ['omega-3'],
      'omega-3': ['omega-3'],
      'omega 3': ['omega-3'],
      'probiotic': ['probiotics'],
      'probiotics': ['probiotics'],
      'collagen': ['collagen'],
      'turmeric': ['turmeric'],
      'melatonin': ['melatonin'],
      'glucosamine': ['joint pain', 'arthritis']
    };

    for (const [key, values] of Object.entries(directMappings)) {
      if (queryLower.includes(key)) {
        return values;
      }
    }

    return [];
  }

  async seedProducts() {
    // Clear existing products first
    await this.productModel.deleteMany({});

    const sampleProducts = [
      {
        title: 'Calcium + Vitamin D3 Tablets',
        description: 'Essential for strong bones and teeth. Helps prevent osteoporosis and supports bone density.',
        price: 24.99,
        tags: ['bone health', 'calcium', 'vitamin D', 'osteoporosis', 'bones', 'teeth'],
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
        inStock: true,
      },
      {
        title: 'Omega-3 Fish Oil Capsules',
        description: 'Supports heart health, brain function, and reduces inflammation. Rich in EPA and DHA.',
        price: 29.99,
        tags: ['heart health', 'omega-3', 'brain', 'cardiovascular', 'inflammation', 'fish oil'],
        image: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400',
        inStock: true,
      },
      {
        title: 'Multivitamin Complex',
        description: 'Complete daily nutrition with 20+ essential vitamins and minerals for overall health.',
        price: 19.99,
        tags: ['multivitamin', 'energy', 'immunity', 'wellness', 'nutrition', 'vitamins'],
        image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400',
        inStock: true,
      },
      {
        title: 'Glucosamine Joint Support',
        description: 'Supports joint flexibility and mobility. Helps reduce joint pain and stiffness.',
        price: 34.99,
        tags: ['joint pain', 'arthritis', 'mobility', 'joints', 'flexibility', 'inflammation'],
        image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400',
        inStock: true,
      },
      {
        title: 'Vitamin B Complex Energy Boost',
        description: 'Increases energy levels and reduces fatigue. Supports metabolism and nervous system.',
        price: 16.99,
        tags: ['energy', 'fatigue', 'b vitamins', 'metabolism', 'nervous system', 'tiredness'],
        image: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400',
        inStock: true,
      },
      {
        title: 'Probiotic Digestive Health',
        description: 'Supports gut health and digestive system. Contains 10 billion CFU per serving.',
        price: 27.99,
        tags: ['digestive health', 'gut', 'probiotics', 'digestion', 'stomach', 'intestinal'],
        image: 'https://images.unsplash.com/photo-1526406915894-7bcd65f60845?w=400',
        inStock: true,
      },
      {
        title: 'Immune System Booster',
        description: 'Strengthens immune system with Vitamin C, Zinc, and Elderberry. Helps fight infections.',
        price: 22.99,
        tags: ['immunity', 'immune system', 'vitamin c', 'zinc', 'cold', 'flu', 'infection'],
        image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400',
        inStock: true,
      },
      {
        title: 'Sleep Support Melatonin',
        description: 'Natural sleep aid with melatonin and calming herbs. Promotes restful sleep.',
        price: 18.99,
        tags: ['sleep', 'insomnia', 'melatonin', 'rest', 'relaxation', 'sleep quality'],
        image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400',
        inStock: true,
      },
      {
        title: 'Collagen Skin Health',
        description: 'Promotes youthful skin, reduces wrinkles, and improves skin elasticity.',
        price: 32.99,
        tags: ['skin health', 'collagen', 'anti-aging', 'wrinkles', 'beauty', 'elasticity'],
        image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400',
        inStock: true,
      },
      {
        title: 'Iron Supplement',
        description: 'Prevents anemia and boosts energy. Essential for red blood cell production.',
        price: 14.99,
        tags: ['iron', 'anemia', 'energy', 'blood', 'fatigue', 'hemoglobin'],
        image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400',
        inStock: true,
      },
      {
        title: 'Turmeric Curcumin',
        description: 'Natural anti-inflammatory with powerful antioxidant properties.',
        price: 21.99,
        tags: ['inflammation', 'turmeric', 'antioxidant', 'joint health', 'pain relief', 'natural'],
        image: 'https://images.unsplash.com/photo-1615485500834-bc10199bc727?w=400',
        inStock: true,
      },
      {
        title: 'Magnesium Glycinate',
        description: 'Supports muscle relaxation, sleep quality, and stress reduction.',
        price: 19.99,
        tags: ['magnesium', 'sleep', 'muscle', 'stress', 'relaxation', 'cramps'],
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
        inStock: true,
      },
    ];

    await this.productModel.insertMany(sampleProducts);
    return { message: 'Sample products seeded successfully', count: sampleProducts.length };
  }
}