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

@Entity('Bundles')
export class Bundle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  bundlePrice: number;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  productIds: string; // JSON array of product IDs

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
