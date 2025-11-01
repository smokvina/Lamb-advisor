import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message } from '../../models/chat.model';

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class ChatMessageComponent {
  message = input.required<Message>();

  renderMarkdown(text: string): string {
    if (!text) {
      return '';
    }
    // FIX: Enhanced markdown rendering to include links and newlines for better formatting of AI responses and search sources.
    // Replace **text** with <strong>text</strong>
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace *text* with <em>text</em>
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Replace [link text](url) with <a href="url" target="_blank">link text</a>
    formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>');
    // Replace newlines with <br>
    formattedText = formattedText.replace(/\n/g, '<br>');
    return formattedText;
  }
}