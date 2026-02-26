import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Chat message model for the AI chatbot UI demo.
 */
interface ChatMessage {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
}

/**
 * AI Chatbot Component
 *
 * A floating chatbot assistant UI placed at the bottom-right corner.
 * Used across Grower and Manufacturer dashboards.
 *
 * Current implementation:
 *  - Static/mock conversation data
 *  - Simulated bot responses
 *  - Smooth open/close animation
 *  - Fully responsive
 */
@Component({
  selector: 'app-ai-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chatbot.component.html',
  styleUrl: './ai-chatbot.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChatbotComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;

  /** Whether the chat panel is open */
  readonly isOpen = signal<boolean>(false);

  /** Whether the bot is "typing" a response */
  readonly isTyping = signal<boolean>(false);

  /** User input bound to the text field */
  readonly userInput = signal<string>('');

  /** All chat messages */
  readonly messages = signal<ChatMessage[]>([
    {
      id: 1,
      sender: 'bot',
      text: 'Hello! 👋 I\'m your AgriMarket assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);

  /** Whether there are messages beyond the initial greeting */
  readonly hasConversation = computed(() => this.messages().length > 1);

  private nextId = 2;
  private shouldScroll = false;

  /** Mock bot responses keyed by simple patterns */
  private readonly mockResponses: { pattern: RegExp; response: string }[] = [
    { pattern: /price|cost|how much|rate/i, response: 'Product prices vary by category and season. You can check current pricing on the Products page. Would you like me to help you find a specific product?' },
    { pattern: /order|buy|purchase|cart/i, response: 'To place an order, browse our product catalog and add items to your cart. You can track existing orders from your Dashboard. Need help with a specific order?' },
    { pattern: /deliver|ship|track|dispatch/i, response: '🚚 Deliveries typically take 3-5 business days depending on your location. You can track your shipments in real-time from the Orders section in your dashboard.' },
    { pattern: /help|support|issue|problem|complaint/i, response: 'I\'m here to help! Here are your options:\n\n• Chat with me for quick answers\n• Email: support@agrimarket.com\n• Call: 1800-123-4567 (Mon-Sat, 9AM-6PM)\n\nWhat issue are you facing?' },
    { pattern: /product|catalog|seed|fertilizer|pesticide|equipment/i, response: '🌱 We have a wide range of agricultural products:\n\n• Seeds (hybrid & organic)\n• Fertilizers & nutrients\n• Pesticides & herbicides\n• Farm equipment & tools\n\nCheck the Products page for the full catalog with current prices!' },
    { pattern: /offer|discount|deal|sale|coupon/i, response: '🏷️ Great question! Check the Current Offers section on your dashboard for:\n\n• Seasonal discounts (up to 30% off)\n• Bulk purchase deals\n• New user offers\n• Festive specials\n\nNew offers are added every week!' },
    { pattern: /account|profile|setting|update/i, response: 'You can manage your account from the Profile section:\n\n• Update personal details\n• Change your password\n• Manage delivery addresses\n• View order history\n\nClick your avatar in the top-right to get started.' },
    { pattern: /payment|pay|upi|card|bank/i, response: '💳 We support multiple payment methods:\n\n• UPI (PhonePe, GPay, Paytm)\n• Credit/Debit cards\n• Net banking\n• Cash on delivery\n\nAll transactions are secured with 256-bit encryption.' },
    { pattern: /return|refund|cancel|exchange/i, response: '🔄 Our return policy:\n\n• 7-day return window for most items\n• Damaged goods replaced for free\n• Refunds processed within 5-7 business days\n\nTo initiate a return, go to Orders → Select order → Request Return.' },
    { pattern: /hi|hello|hey|namaste/i, response: 'Hello! 👋 Welcome to AgriMarket. I can help you with products, orders, deliveries, offers, and more. What would you like to know?' },
    { pattern: /thank|thanks|dhanyavaad/i, response: 'You\'re welcome! 😊 Happy to help. Let me know if there\'s anything else I can assist you with.' },
    { pattern: /bye|goodbye|see you/i, response: 'Goodbye! 🌾 Have a great day. Feel free to reach out anytime you need help. Happy farming!' },
    { pattern: /weather|rain|season|climate/i, response: '🌤️ While I don\'t have live weather data, I can recommend seasonal products based on the current farming season. Would you like product suggestions for this season?' },
  ];

  private readonly defaultResponse = 'Thanks for your message! I\'m currently in demo mode with limited responses. Here\'s what I can help with:\n\n• 🌱 Product information\n• 📦 Order tracking\n• 🏷️ Current offers\n• 🚚 Delivery status\n• 💳 Payment help\n\nTry asking about any of these topics!';

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggleChat(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.shouldScroll = true;
    }
  }

  closeChat(): void {
    this.isOpen.set(false);
  }

  onInputChange(value: string): void {
    this.userInput.set(value);
  }

  sendMessage(): void {
    const text = this.userInput().trim();
    if (!text) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: this.nextId++,
      sender: 'user',
      text,
      timestamp: new Date(),
    };
    this.messages.update((msgs) => [...msgs, userMsg]);
    this.userInput.set('');
    this.shouldScroll = true;

    // Simulate bot typing
    this.isTyping.set(true);
    setTimeout(() => {
      const botReply = this.getBotResponse(text);
      const botMsg: ChatMessage = {
        id: this.nextId++,
        sender: 'bot',
        text: botReply,
        timestamp: new Date(),
      };
      this.messages.update((msgs) => [...msgs, botMsg]);
      this.isTyping.set(false);
      this.shouldScroll = true;
    }, 800 + Math.random() * 700);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private getBotResponse(input: string): string {
    for (const entry of this.mockResponses) {
      if (entry.pattern.test(input)) {
        return entry.response;
      }
    }
    return this.defaultResponse;
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch {
      // ignore
    }
  }
}
