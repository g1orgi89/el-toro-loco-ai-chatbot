#!/bin/bash

# Скрипт для комплексного тестирования RAG системы Shrooms Support Bot
# Автор: Shrooms Development Team
# Версия: 1.0.0

echo "🍄 Shrooms Support Bot - RAG Testing Suite"
echo "=========================================="

# Функция для проверки доступности сервера
check_server() {
    echo "🔍 Checking server availability..."
    
    if curl -f -s http://localhost:3000/api/health >/dev/null; then
        echo "✅ Server is running"
        return 0
    else
        echo "❌ Server is not accessible at http://localhost:3000"
        echo "   Please start the server with: npm start"
        return 1
    fi
}

# Функция для проверки базы знаний
check_knowledge_base() {
    echo "📚 Checking knowledge base status..."
    
    response=$(curl -s http://localhost:3000/api/knowledge/stats)
    if echo "$response" | grep -q '"success":true'; then
        doc_count=$(echo "$response" | grep -o '"documentsCount":[0-9]*' | cut -d':' -f2)
        echo "✅ Knowledge base available with $doc_count documents"
        return 0
    else
        echo "⚠️  Knowledge base may not be initialized"
        echo "   Run: npm run load-kb"
        return 1
    fi
}

# Функция для запуска базовых API тестов
run_basic_tests() {
    echo "🧪 Running basic API tests..."
    
    # Тест Health Check
    echo "  Testing health endpoint..."
    if curl -f -s http://localhost:3000/api/health >/dev/null; then
        echo "  ✅ Health check passed"
    else
        echo "  ❌ Health check failed"
        return 1
    fi
    
    # Тест Chat API
    echo "  Testing chat endpoint..."
    response=$(curl -s -X POST http://localhost:3000/api/chat \
        -H "Content-Type: application/json" \
        -d '{"message": "Test message", "userId": "test-user"}')
    
    if echo "$response" | grep -q '"success":true'; then
        echo "  ✅ Chat API responding"
    else
        echo "  ❌ Chat API failed"
        echo "  Response: $response"
        return 1
    fi
    
    # Тест RAG endpoint
    echo "  Testing RAG endpoint..."
    response=$(curl -s -X POST http://localhost:3000/api/chat/test-rag \
        -H "Content-Type: application/json" \
        -d '{"query": "wallet connection"}')
    
    if echo "$response" | grep -q '"success":true'; then
        echo "  ✅ RAG endpoint responding"
    else
        echo "  ❌ RAG endpoint failed"
        return 1
    fi
    
    return 0
}

# Функция для запуска RAG quality тестов
run_rag_quality_tests() {
    echo "🎯 Running RAG quality tests..."
    
    if command -v node >/dev/null 2>&1; then
        if [ -f "tests/integration/rag-quality.test.js" ]; then
            node tests/integration/rag-quality.test.js
            return $?
        else
            echo "❌ RAG quality test file not found"
            return 1
        fi
    else
        echo "❌ Node.js not found"
        return 1
    fi
}

# Функция для тестирования многоязычности
test_multilingual_rag() {
    echo "🌍 Testing multilingual RAG..."
    
    # Тестовые запросы на разных языках
    declare -a test_queries=(
        '{"query": "How to connect wallet?", "language": "en"}'
        '{"query": "Как подключить кошелек?", "language": "ru"}'  
        '{"query": "¿Cómo conectar billetera?", "language": "es"}'
    )
    
    for query in "${test_queries[@]}"; do
        lang=$(echo "$query" | grep -o '"language": "[^"]*"' | cut -d'"' -f4)
        echo "  Testing $lang..."
        
        response=$(curl -s -X POST http://localhost:3000/api/chat/test-rag \
            -H "Content-Type: application/json" \
            -d "$query")
        
        if echo "$response" | grep -q '"success":true'; then
            count=$(echo "$response" | grep -o '"count":[0-9]*' | head -1 | cut -d':' -f2)
            echo "    ✅ Found $count documents"
        else
            echo "    ❌ Failed to search"
        fi
    done
}

# Функция для тестирования производительности
test_performance() {
    echo "⚡ Testing RAG performance..."
    
    echo "  Running 5 queries to measure response time..."
    total_time=0
    successful_queries=0
    
    for i in {1..5}; do
        start_time=$(date +%s%3N)
        
        response=$(curl -s -X POST http://localhost:3000/api/chat \
            -H "Content-Type: application/json" \
            -d '{"message": "How does staking work?", "userId": "perf-test-'$i'"}')
        
        end_time=$(date +%s%3N)
        duration=$((end_time - start_time))
        
        if echo "$response" | grep -q '"success":true'; then
            echo "    Query $i: ${duration}ms"
            total_time=$((total_time + duration))
            successful_queries=$((successful_queries + 1))
        else
            echo "    Query $i: Failed"
        fi
    done
    
    if [ $successful_queries -gt 0 ]; then
        avg_time=$((total_time / successful_queries))
        echo "  📊 Average response time: ${avg_time}ms"
        
        if [ $avg_time -lt 5000 ]; then
            echo "  ✅ Performance acceptable (<5s)"
        else
            echo "  ⚠️  Performance slow (>5s)"
        fi
    else
        echo "  ❌ No successful queries"
    fi
}

# Функция для открытия веб-интерфейса тестирования
open_test_interface() {
    echo "🌐 Opening RAG test interface..."
    
    # Проверяем, доступен ли файл
    if [ -f "test-chat-rag.html" ]; then
        url="http://localhost:3000/test-chat-rag.html"
        echo "  Test interface available at: $url"
        
        # Пытаемся открыть браузер
        if command -v xdg-open >/dev/null; then
            xdg-open "$url" 2>/dev/null &
        elif command -v open >/dev/null; then
            open "$url" 2>/dev/null &
        elif command -v start >/dev/null; then
            start "$url" 2>/dev/null &
        else
            echo "  Please open $url in your browser"
        fi
    else
        echo "  ⚠️  test-chat-rag.html not found"
    fi
}

# Функция для показа статистики базы знаний
show_knowledge_stats() {
    echo "📈 Knowledge Base Statistics"
    echo "----------------------------"
    
    # Получаем статистику через API
    response=$(curl -s http://localhost:3000/api/knowledge/stats)
    
    if echo "$response" | grep -q '"success":true'; then
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo "❌ Could not retrieve knowledge base statistics"
    fi
}

# Основная функция
main() {
    case "$1" in
        "all")
            echo "🚀 Running complete RAG test suite..."
            check_server || exit 1
            check_knowledge_base
            run_basic_tests || exit 1
            test_multilingual_rag
            test_performance
            run_rag_quality_tests
            echo "✅ All tests completed!"
            ;;
        "basic")
            check_server || exit 1
            run_basic_tests || exit 1
            ;;
        "quality")
            check_server || exit 1
            run_rag_quality_tests || exit 1
            ;;
        "multilingual")
            check_server || exit 1
            test_multilingual_rag
            ;;
        "performance")
            check_server || exit 1
            test_performance
            ;;
        "interface")
            check_server || exit 1
            open_test_interface
            ;;
        "stats")
            check_server || exit 1
            show_knowledge_stats
            ;;
        "help"|"--help"|"-h")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  all          Run complete test suite"
            echo "  basic        Run basic API tests"
            echo "  quality      Run RAG quality tests"
            echo "  multilingual Test multilingual capabilities"
            echo "  performance  Test response performance"
            echo "  interface    Open web test interface"
            echo "  stats        Show knowledge base statistics"
            echo "  help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 all              # Run all tests"
            echo "  $0 basic            # Quick API check"
            echo "  $0 interface        # Open browser testing"
            ;;
        *)
            echo "❓ No command specified. Running basic checks..."
            check_server || exit 1
            check_knowledge_base
            run_basic_tests || exit 1
            echo ""
            echo "💡 Run '$0 help' to see all available commands"
            echo "💡 Run '$0 all' to execute complete test suite"
            echo "💡 Run '$0 interface' to open web testing interface"
            ;;
    esac
}

# Запуск основной функции с переданными аргументами
main "$@"