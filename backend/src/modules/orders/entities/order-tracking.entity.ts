import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('OrderTracking')
export class OrderTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @OneToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  carrier: string;

  @Column({ nullable: true })
  trackingNumber: string;

  @Column({ nullable: true, type: 'nvarchar', length: 'max' })
  trackingUrl: string;

  @Column({ nullable: true })
  estimatedDelivery: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  updatedAt: Date;
}
