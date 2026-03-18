import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationType, NotificationChannel } from '../../../common/enums';

@Entity('Notifications')
@Index(['userId'])
@Index(['isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'nvarchar' })
  type: NotificationType;

  @Column({ type: 'nvarchar', length: 'max' })
  title: string;

  @Column({ type: 'nvarchar', length: 'max' })
  message: string;

  @Column({ type: 'nvarchar' })
  channel: NotificationChannel;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: Date;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ nullable: true })
  referenceType: string;

  @CreateDateColumn()
  createdAt: Date;
}
