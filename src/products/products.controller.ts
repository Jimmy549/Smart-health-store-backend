import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async searchProducts(
    @Query('query') query: string,
    @Query('searchType') searchType: 'normal' | 'ai' = 'normal',
  ) {
    return this.productsService.searchProducts(query || '', searchType);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createProduct(@Body() productData: any) {
    return this.productsService.createProduct(productData);
  }

  @Post('seed')
  async seedProducts() {
    return this.productsService.seedProducts();
  }
}