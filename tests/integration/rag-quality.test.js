/**
 * @fileoverview Автоматизированные тесты для проверки RAG качества
 * @description Тестирует качество ответов с использованием RAG vs без RAG
 */

const fs = require('fs');
const path = require('path');

/**
 * Тестовые сценарии для проверки RAG
 */
const RAG_TEST_SCENARIOS = {
  // Вопросы, на которые должны быть ответы в базе знаний
  knowledgeBaseQuestions: {
    en: [
      {
        query: "How do I connect Xverse wallet?",
        expectedTopics: ["xverse", "wallet", "connect", "browser", "extension"],
        category: "user-guide",
        shouldFindDocs: true
      },
      {
        query: "What is SHROOMS staking?",
        expectedTopics: ["staking", "shrooms", "rewards", "apy"],
        category: "tokenomics", 
        shouldFindDocs: true
      },
      {
        query: "How does farming work in Shrooms?",
        expectedTopics: ["farming", "liquidity", "rewards", "pools"],
        category: "tokenomics",
        shouldFindDocs: true
      }
    ],
    ru: [
      {
        query: "Как подключить кошелек Xverse?",
        expectedTopics: ["xverse", "кошелек", "подключ", "расширение"],
        category: "user-guide",
        shouldFindDocs: true
      },
      {
        query: "Что такое стейкинг SHROOMS?",
        expectedTopics: ["стейкинг", "shrooms", "вознаграждения"],
        category: "tokenomics",
        shouldFindDocs: true
      },
      {
        query: "Как работает фарминг в Shrooms?",
        expectedTopics: ["фарминг", "ликвидность", "пулы"],
        category: "tokenomics",
        shouldFindDocs: true
      }
    ],
    es: [
      {
        query: "¿Cómo conectar billetera Xverse?",
        expectedTopics: ["xverse", "billetera", "conectar"],
        category: "user-guide",
        shouldFindDocs: true
      }
    ]
  },

  // Вопросы, на которые НЕ должно быть ответов в базе знаний
  offTopicQuestions: {
    en: [
      {
        query: "What's the weather today?",
        expectedTopics: [],
        category: "off-topic",
        shouldFindDocs: false
      },
      {
        query: "Tell me about Bitcoin price",
        expectedTopics: [],
        category: "off-topic", 
        shouldFindDocs: false
      },
      {
        query: "How to cook pasta?",
        expectedTopics: [],
        category: "off-topic",
        shouldFindDocs: false
      }
    ],
    ru: [
      {
        query: "Какая сегодня погода?",
        expectedTopics: [],
        category: "off-topic",
        shouldFindDocs: false
      },
      {
        query: "Расскажи о цене биткоина",
        expectedTopics: [],
        category: "off-topic",
        shouldFindDocs: false
      }
    ]
  },

  // Пограничные случаи
  borderlineCases: {
    en: [
      {
        query: "What is blockchain?", // Общий вопрос о блокчейне
        expectedTopics: ["blockchain", "stacks"],
        category: "borderline",
        shouldFindDocs: false // Если нет общих статей о блокчейне
      },
      {
        query: "How to buy cryptocurrency?", // Общий крипто вопрос
        expectedTopics: [],
        category: "borderline",
        shouldFindDocs: false
      }
    ]
  }
};

/**
 * Класс для тестирования RAG качества
 */
class RAGQualityTester {
  constructor(apiBase = 'http://localhost:3000/api') {
    this.apiBase = apiBase;
    this.results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      details: []
    };
  }

  /**
   * Запускает все тесты RAG
   */
  async runAllTests() {
    console.log('🧪 Starting RAG Quality Tests...\n');
    
    // Тест 1: Проверка поиска в базе знаний
    await this.testKnowledgeBaseRetrieval();
    
    // Тест 2: Проверка фильтрации off-topic запросов
    await this.testOffTopicFiltering();
    
    // Тест 3: Проверка многоязычности
    await this.testMultilingualRAG();
    
    // Тест 4: Сравнение качества ответов с RAG и без RAG
    await this.testRAGQualityComparison();
    
    // Тест 5: Проверка производительности
    await this.testRAGPerformance();
    
    this.generateReport();
  }

  /**
   * Тестирует поиск релевантных документов
   */
  async testKnowledgeBaseRetrieval() {
    console.log('📚 Testing Knowledge Base Retrieval...');
    
    for (const [language, questions] of Object.entries(RAG_TEST_SCENARIOS.knowledgeBaseQuestions)) {
      for (const scenario of questions) {
        await this.runRetrievalTest(scenario, language);
      }
    }
  }

  /**
   * Выполняет тест поиска для одного сценария
   */
  async runRetrievalTest(scenario, language) {
    try {
      const response = await fetch(`${this.apiBase}/chat/test-rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: scenario.query,
          language: language,
          thresholds: [0.9, 0.8, 0.7, 0.6, 0.5]
        })
      });

      const data = await response.json();
      this.totalTests++;

      if (data.success) {
        const foundDocs = data.data.automaticSearch?.count || 0;
        const hasExpectedResults = scenario.shouldFindDocs ? foundDocs > 0 : foundDocs === 0;
        
        if (hasExpectedResults) {
          this.passedTests++;
          console.log(`  ✅ [${language}] "${scenario.query}" - Found ${foundDocs} docs (expected: ${scenario.shouldFindDocs ? '>0' : '0'})`);
          
          // Дополнительная проверка релевантности найденных документов
          if (foundDocs > 0 && scenario.expectedTopics.length > 0) {
            await this.checkDocumentRelevance(data.data.automaticSearch.documents, scenario.expectedTopics);
          }
        } else {
          this.failedTests++;
          console.log(`  ❌ [${language}] "${scenario.query}" - Found ${foundDocs} docs (expected: ${scenario.shouldFindDocs ? '>0' : '0'})`);
        }

        this.results.details.push({
          test: 'knowledge_retrieval',
          language: language,
          query: scenario.query,
          category: scenario.category,
          foundDocs: foundDocs,
          expected: scenario.shouldFindDocs,
          passed: hasExpectedResults,
          scores: data.data.automaticSearch?.scores || []
        });
      } else {
        this.failedTests++;
        console.log(`  ❌ [${language}] "${scenario.query}" - API Error: ${data.error}`);
      }
    } catch (error) {
      this.failedTests++;
      console.log(`  ❌ [${language}] "${scenario.query}" - Error: ${error.message}`);
    }
  }

  /**
   * Проверяет релевантность найденных документов
   */
  async checkDocumentRelevance(documents, expectedTopics) {
    if (!documents || documents.length === 0) return;

    let relevantDocs = 0;
    for (const doc of documents) {
      const content = doc.preview?.toLowerCase() || '';
      const hasRelevantTopics = expectedTopics.some(topic => 
        content.includes(topic.toLowerCase())
      );
      
      if (hasRelevantTopics) {
        relevantDocs++;
      }
    }

    const relevanceRate = relevantDocs / documents.length;
    if (relevanceRate >= 0.5) { // 50% документов должны быть релевантными
      console.log(`    📊 Document relevance: ${Math.round(relevanceRate * 100)}% (${relevantDocs}/${documents.length})`);
    } else {
      console.log(`    ⚠️  Low document relevance: ${Math.round(relevanceRate * 100)}% (${relevantDocs}/${documents.length})`);
    }
  }

  /**
   * Тестирует фильтрацию off-topic запросов
   */
  async testOffTopicFiltering() {
    console.log('\n🚫 Testing Off-Topic Filtering...');
    
    for (const [language, questions] of Object.entries(RAG_TEST_SCENARIOS.offTopicQuestions)) {
      for (const scenario of questions) {
        await this.runRetrievalTest(scenario, language);
      }
    }
  }

  /**
   * Тестирует многоязычность RAG
   */
  async testMultilingualRAG() {
    console.log('\n🌍 Testing Multilingual RAG...');
    
    // Тестируем одинаковые вопросы на разных языках
    const commonQuestions = {
      wallet_connection: {
        en: "How to connect wallet?",
        ru: "Как подключить кошелек?",
        es: "¿Cómo conectar billetera?"
      },
      staking_info: {
        en: "What is staking?",
        ru: "Что такое стейкинг?",
        es: "¿Qué es el staking?"
      }
    };

    for (const [topic, translations] of Object.entries(commonQuestions)) {
      console.log(`  Testing topic: ${topic}`);
      const results = {};
      
      for (const [lang, query] of Object.entries(translations)) {
        try {
          const response = await fetch(`${this.apiBase}/chat/test-rag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: query,
              language: lang
            })
          });

          const data = await response.json();
          if (data.success) {
            results[lang] = data.data.automaticSearch?.count || 0;
          }
        } catch (error) {
          console.log(`    ❌ Error testing ${lang}: ${error.message}`);
        }
      }

      // Проверяем, что все языки дают сопоставимые результаты
      const docCounts = Object.values(results);
      if (docCounts.length > 1) {
        const maxDocs = Math.max(...docCounts);
        const minDocs = Math.min(...docCounts);
        const variance = maxDocs - minDocs;
        
        if (variance <= 2) { // Разница не более 2 документов
          console.log(`    ✅ Consistent across languages: ${JSON.stringify(results)}`);
          this.passedTests++;
        } else {
          console.log(`    ⚠️  High variance across languages: ${JSON.stringify(results)}`);
          this.failedTests++;
        }
        this.totalTests++;
      }
    }
  }

  /**
   * Сравнивает качество ответов с RAG и без RAG
   */
  async testRAGQualityComparison() {
    console.log('\n🔄 Testing RAG vs Non-RAG Quality...');
    
    const testQueries = [
      "How do I connect my wallet?",
      "What are the staking rewards?",
      "Как работает фарминг?"
    ];

    for (const query of testQueries) {
      try {
        // Запрос без RAG
        const responseWithoutRAG = await this.sendChatMessage(query, false);
        // Запрос с RAG
        const responseWithRAG = await this.sendChatMessage(query, true);
        
        if (responseWithoutRAG.success && responseWithRAG.success) {
          const withoutRAGLength = responseWithoutRAG.data.message.length;
          const withRAGLength = responseWithRAG.data.message.length;
          const hasRAGData = responseWithRAG.data.metadata?.ragUsed || false;
          
          console.log(`  📝 "${query.substring(0, 30)}..."`);
          console.log(`    Without RAG: ${withoutRAGLength} chars`);
          console.log(`    With RAG: ${withRAGLength} chars (RAG used: ${hasRAGData})`);
          
          // Простая эвристика: ответ с RAG должен быть более детальным
          if (hasRAGData && withRAGLength > withoutRAGLength * 1.2) {
            console.log(`    ✅ RAG provides more detailed response`);
            this.passedTests++;
          } else if (!hasRAGData) {
            console.log(`    ⚠️  RAG was not used for this query`);
          } else {
            console.log(`    ❌ RAG response not significantly better`);
            this.failedTests++;
          }
          this.totalTests++;
        }
      } catch (error) {
        console.log(`  ❌ Error comparing responses: ${error.message}`);
        this.failedTests++;
        this.totalTests++;
      }
    }
  }

  /**
   * Тестирует производительность RAG
   */
  async testRAGPerformance() {
    console.log('\n⚡ Testing RAG Performance...');
    
    const testQuery = "How to connect wallet?";
    const iterations = 5;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const response = await this.sendChatMessage(testQuery, true);
        const endTime = Date.now();
        
        if (response.success) {
          times.push(endTime - startTime);
        }
      } catch (error) {
        console.log(`  ❌ Performance test iteration ${i + 1} failed: ${error.message}`);
      }
    }

    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`  📊 Average response time: ${Math.round(avgTime)}ms`);
      console.log(`  📊 Min/Max: ${minTime}ms / ${maxTime}ms`);
      
      // Проверяем, что среднее время ответа разумное (< 5 секунд)
      if (avgTime < 5000) {
        console.log(`  ✅ Performance within acceptable limits`);
        this.passedTests++;
      } else {
        console.log(`  ❌ Performance too slow (>${avgTime}ms)`);
        this.failedTests++;
      }
      this.totalTests++;

      this.results.details.push({
        test: 'performance',
        avgTime: avgTime,
        maxTime: maxTime,
        minTime: minTime,
        iterations: times.length
      });
    }
  }

  /**
   * Отправляет сообщение в чат API
   */
  async sendChatMessage(message, useRAG = true) {
    const response = await fetch(`${this.apiBase}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        userId: `rag-test-${Date.now()}`,
        useRag: useRAG
      })
    });

    return await response.json();
  }

  /**
   * Генерирует отчет о тестировании
   */
  generateReport() {
    console.log('\n📊 RAG Quality Test Report');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests} (${Math.round(this.passedTests / this.totalTests * 100)}%)`);
    console.log(`Failed: ${this.failedTests} (${Math.round(this.failedTests / this.totalTests * 100)}%)`);
    console.log('='.repeat(50));

    // Сохраняем детальный отчет в файл
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        successRate: Math.round(this.passedTests / this.totalTests * 100)
      },
      details: this.results.details
    };

    const reportPath = path.join(__dirname, `../logs/rag-test-report-${Date.now()}.json`);
    try {
      // Создаем директорию logs если не существует
      const logsDir = path.dirname(reportPath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📁 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️  Could not save report: ${error.message}`);
    }

    // Возвращаем результаты
    return reportData;
  }
}

// Экспорт для использования в тестах
module.exports = {
  RAGQualityTester,
  RAG_TEST_SCENARIOS
};

// Запуск тестов при прямом выполнении файла
if (require.main === module) {
  const tester = new RAGQualityTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n🎉 RAG Quality Testing completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 RAG Quality Testing failed:', error);
      process.exit(1);
    });
}