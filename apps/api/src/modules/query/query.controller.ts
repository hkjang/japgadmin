import { Controller, Get, Post, Body, Query as QueryParam } from '@nestjs/common';
import { QueryService } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Get('slow')
  async getSlowQueries(
    @QueryParam('limit') limit?: string,
    @QueryParam('minTime') minTime?: string,
  ) {
    return this.queryService.getSlowQueries(
      parseInt(limit || '50'),
      parseFloat(minTime || '1000'),
    );
  }

  @Post('explain')
  async explainQuery(@Body() body: { query: string; analyze?: boolean }) {
    return this.queryService.explainQuery(body.query, body.analyze);
  }

  @Get('history')
  async getQueryHistory(
    @QueryParam('limit') limit?: string,
    @QueryParam('queryHash') queryHash?: string,
  ) {
    return this.queryService.getQueryHistory(
      parseInt(limit || '100'),
      queryHash,
    );
  }

  @Get('stats')
  async getQueryStats() {
    return this.queryService.getQueryStats();
  }
}
