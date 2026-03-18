import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DiscountType {
  PERCENTAGE = 'Percentage',
  FIXED = 'Fixed',
}

@Entity('Promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'nvarchar', length: 'max' })
  description: string;

  @Column({ type: 'nvarchar' })
  discountType: DiscountType;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  discountValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumOrderAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maximumDiscount: number;

  @Column({ type: 'datetime' })
  startDate: Date;

  @Column({ type: 'datetime' })
  endDate: Date;

  @Column({ type: 'int', default: 1 })
  usageLimit: number;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  sellerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
