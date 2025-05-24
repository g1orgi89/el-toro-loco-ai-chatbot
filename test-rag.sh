#!/bin/bash

# 🍄 Shrooms RAG Test Runner
# Скрипт для запуска различных типов RAG тестов

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}"
}

# Проверка аргументов
TEST_TYPE=${1:-"basic"}

# API базовый URL
API_BASE=${API_BASE:-"http://localhost:3000/api"}

# Функция проверки сервера
check_server() {
    log "🔍 Checking server health..."
    
    if ! curl -f -s "$API_BASE/health" > /dev/null; then
        error "Server is not running or not accessible at $API_BASE"
        error "Please start the server with: npm run dev"
        exit 1
    fi
    
    log "✅ Server is running"
}

# Функция базового тестирования
run_basic_tests() {
    log "🧪 Running basic RAG tests..."
    
    # Тест поиска документов
    log "Testing document search..."
    curl -s -X POST "$API_BASE/chat/test-rag" \
        -H "Content-Type: application/json" \
        -d '{"query": "How to connect wallet?", "language": "en"}' | jq '.'
    
    echo ""
    
    # Тест многоязычности
    log "Testing multilingual search..."
    curl -s -X POST "$API_BASE/chat/test-rag" \
        -H "Content-Type: application/json" \
        -d '{"query": "Как подключить кошелек?", "language": "ru"}' | jq '.'
}

# Функция полного тестирования
run_all_tests() {
    log "🚀 Running comprehensive RAG quality tests..."
    
    if command -v node &> /dev/null; then
        node tests/integration/rag-quality.test.js
    else
        error "Node.js not found. Please install Node.js to run comprehensive tests."
        exit 1
    fi
}

# Функция тестирования многоязычности
run_multilingual_tests() {
    log "🌍 Running multilingual tests..."
    
    local queries=(
        '{"query": "How do I connect Xverse wallet?", "language": "en"}'
        '{"query": "Как подключить кошелек Xverse?", "language": "ru"}'
        '{"query": "¿Cómo conectar billetera Xverse?", "language": "es"}'
    )
    
    for query in "${queries[@]}"; do
        info "Testing: $(echo $query | jq -r '.query')"
        curl -s -X POST "$API_BASE/chat/test-rag" \
            -H "Content-Type: application/json" \
            -d "$query" | jq '.data.automaticSearch | {count: .count, scores: .scores}'
        echo ""
    done
}

# Функция тестирования производительности
run_performance_tests() {
    log "⚡ Running performance tests..."
    
    local query='{"query": "What is SHROOMS staking?", "language": "en"}'
    local iterations=5
    local total_time=0
    
    for ((i=1; i<=iterations; i++)); do
        info "Iteration $i/$iterations"
        
        local start_time=$(date +%s%3N)
        curl -s -X POST "$API_BASE/chat/test-rag" \
            -H "Content-Type: application/json" \
            -d "$query" > /dev/null
        local end_time=$(date +%s%3N)
        
        local duration=$((end_time - start_time))
        total_time=$((total_time + duration))
        
        echo "  Response time: ${duration}ms"
        sleep 1
    done
    
    local avg_time=$((total_time / iterations))
    log "📊 Average response time: ${avg_time}ms"
    
    if [ $avg_time -lt 5000 ]; then
        log "✅ Performance test PASSED (< 5s)"
    else
        warn "⚠️ Performance test WARNING (> 5s)"
    fi
}

# Функция тестирования интерфейса
run_interface_tests() {
    log "🖥️ Testing RAG debug interface..."
    
    local interface_url="http://localhost:3000/test-rag-debug.html"
    
    if curl -f -s "$interface_url" > /dev/null; then
        log "✅ RAG debug interface is accessible at: $interface_url"
        info "Open this URL in your browser to test RAG functionality interactively"
    else
        warn "⚠️ RAG debug interface not accessible. Check if static files are served correctly."
    fi
}

# Функция получения статистики
show_stats() {
    log "📊 Getting RAG system statistics..."
    
    # Health check с деталями
    info "System Health:"
    curl -s "$API_BASE/health" | jq '.services'
    
    echo ""
    
    # Chat статистика
    info "Chat Statistics:"
    curl -s "$API_BASE/chat/stats" | jq '.data'
    
    echo ""
    
    # Статистика языков
    info "Supported Languages:"
    curl -s "$API_BASE/chat/languages" | jq '.data.supportedLanguages'
}

# Главная функция
main() {
    echo "🍄 Shrooms RAG Test Runner"
    echo "=========================="
    echo ""
    
    check_server
    
    case $TEST_TYPE in
        "basic")
            run_basic_tests
            ;;
        "all")
            run_all_tests
            ;;
        "multilingual")
            run_multilingual_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "interface")
            run_interface_tests
            ;;
        "stats")
            show_stats
            ;;
        *)
            echo "Usage: $0 [basic|all|multilingual|performance|interface|stats]"
            echo ""
            echo "Test types:"
            echo "  basic        - Quick RAG functionality test"
            echo "  all          - Comprehensive quality tests"
            echo "  multilingual - Test multi-language support"
            echo "  performance  - Test response times"
            echo "  interface    - Check debug interface"
            echo "  stats        - Show system statistics"
            echo ""
            echo "Examples:"
            echo "  $0 basic"
            echo "  $0 all"
            echo "  $0 stats"
            exit 1
            ;;
    esac
    
    echo ""
    log "🎉 Test completed!"
}

# Проверка зависимостей
if ! command -v curl &> /dev/null; then
    error "curl is required but not installed."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    warn "jq is not installed. Install it for better output formatting."
    warn "On Ubuntu/Debian: sudo apt install jq"
    warn "On macOS: brew install jq"
fi

# Запуск основной функции
main "$@"