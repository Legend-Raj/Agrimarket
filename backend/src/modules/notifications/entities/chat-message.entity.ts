import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

@Entity('ChatMessages')
@Index(['sessionId'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => ChatSession, (session) => session.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: ChatSession;

  @Column({ type: 'nvarchar', length: 'max' })
  userMessage: string;

  @Column({ type: 'nvarchar', length: 'max' })
  assistantMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
