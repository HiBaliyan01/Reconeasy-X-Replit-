import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Zap, BarChart3, RefreshCw, AlertTriangle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'action' | 'chart';
  actions?: Array<{ label: string; action: string }>;
}

export default function EnhancedChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m your ReconEasy AI assistant. I can help you with payment reconciliation, return analytics, exception handling, and system navigation. What would you like to know?',
      sender: 'bot',
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickActions = [
    { label: 'Auto-reconcile pending UTRs', icon: Zap, action: 'auto_reconcile' },
    { label: 'Show exception summary', icon: AlertTriangle, action: 'exceptions' },
    { label: 'Generate performance report', icon: BarChart3, action: 'report' },
    { label: 'Return analytics insights', icon: RefreshCw, action: 'returns' }
  ];

  const getEnhancedBotResponse = (userMessage: string): Message => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('auto') && lowerMessage.includes('reconcile')) {
      return {
        id: Date.now().toString(),
        text: 'I can help you auto-reconcile transactions. Currently, 85% of your transactions are auto-matched. Would you like me to process the remaining 15% that require manual review?',
        sender: 'bot',
        timestamp: new Date(),
        type: 'action',
        actions: [
          { label: 'Process All', action: 'process_all' },
          { label: 'Review Exceptions', action: 'review_exceptions' },
          { label: 'Show Details', action: 'show_details' }
        ]
      };
    }
    
    if (lowerMessage.includes('exception') || lowerMessage.includes('error')) {
      return {
        id: Date.now().toString(),
        text: 'You have 12 exceptions requiring attention: 8 amount mismatches (avg ₹150), 3 missing UTRs, and 1 duplicate transaction. The AI confidence score is 94% for auto-resolution.',
        sender: 'bot',
        timestamp: new Date(),
        type: 'action',
        actions: [
          { label: 'Auto-resolve High Confidence', action: 'auto_resolve' },
          { label: 'Manual Review Queue', action: 'manual_review' },
          { label: 'Exception Details', action: 'exception_details' }
        ]
      };
    }
    
    if (lowerMessage.includes('performance') || lowerMessage.includes('report')) {
      return {
        id: Date.now().toString(),
        text: 'System performance is excellent: 98.7% accuracy, 2.3s avg response time, 99.2% uptime. Today processed 45,230 transactions with 95% auto-match rate. Would you like a detailed report?',
        sender: 'bot',
        timestamp: new Date(),
        type: 'action',
        actions: [
          { label: 'Download PDF Report', action: 'download_pdf' },
          { label: 'Email Report', action: 'email_report' },
          { label: 'Schedule Reports', action: 'schedule_reports' }
        ]
      };
    }
    
    if (lowerMessage.includes('return') || lowerMessage.includes('analytics')) {
      return {
        id: Date.now().toString(),
        text: 'Return analytics show: 18.5% return rate (down 2.1%), top reason is size issues (35%), highest returns from Myntra (25% rate). AI predicts 15% increase next week due to sale season.',
        sender: 'bot',
        timestamp: new Date(),
        type: 'action',
        actions: [
          { label: 'View Return Trends', action: 'return_trends' },
          { label: 'SKU Analysis', action: 'sku_analysis' },
          { label: 'Forecast Details', action: 'forecast_details' }
        ]
      };
    }
    
    if (lowerMessage.includes('utr') || lowerMessage.includes('match')) {
      return {
        id: Date.now().toString(),
        text: 'UTR matching is running smoothly. Smart matching algorithm has 95% success rate. 234 UTRs processed today, 12 pending manual review. Average matching time: 1.8 seconds.',
        sender: 'bot',
        timestamp: new Date(),
        type: 'text'
      };
    }
    
    return {
      id: Date.now().toString(),
      text: 'I can help you with: Auto-reconciliation, Exception handling, Performance monitoring, Return analytics, UTR matching, Report generation, and System navigation. What specific task would you like assistance with?',
      sender: 'bot',
      timestamp: new Date(),
      type: 'text'
    };
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI processing time
    setTimeout(() => {
      const botResponse = getEnhancedBotResponse(inputText);
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickAction = (action: string) => {
    const actionMessages = {
      auto_reconcile: 'Start auto-reconciliation for pending UTRs',
      exceptions: 'Show me all current exceptions',
      report: 'Generate today\'s performance report',
      returns: 'Analyze return patterns and trends'
    };
    
    setInputText(actionMessages[action as keyof typeof actionMessages] || action);
  };

  const handleActionClick = (action: string) => {
    // Simulate action execution
    const actionResponse: Message = {
      id: (Date.now() + 1).toString(),
      text: `Action "${action}" has been executed successfully. Results will be displayed in the main dashboard.`,
      sender: 'bot',
      timestamp: new Date(),
      type: 'text'
    };
    
    setMessages(prev => [...prev, actionResponse]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Enhanced Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center z-50 ${
          isOpen ? 'scale-0' : 'scale-100 hover:scale-110'
        }`}
      >
        <MessageCircle className="w-7 h-7" />
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
          AI
        </div>
      </button>

      {/* Enhanced Chat Window */}
      <div className={`fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 transition-all duration-300 z-50 ${
        isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
      }`}>
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bot className="w-6 h-6" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h3 className="font-semibold">ReconEasy AI Assistant</h3>
              <p className="text-xs text-teal-100">Intelligent reconciliation support</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 h-96 overflow-y-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-2 max-w-[85%] ${
                message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? 'bg-teal-500 text-white' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {message.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}>
                  <p className="text-sm">{message.text}</p>
                  
                  {/* Action Buttons */}
                  {message.actions && (
                    <div className="mt-3 space-y-2">
                      {message.actions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => handleActionClick(action.action)}
                          className="block w-full text-left px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 p-3 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Quick actions:</p>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action.action)}
                  className="flex items-center space-x-2 text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 px-2 py-2 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
                >
                  <action.icon className="w-3 h-3" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Input */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about reconciliation, exceptions, or analytics..."
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              className="bg-teal-500 text-white p-2 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}