import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { OrderStatus } from '../../../common/enums';

@Entity('OrderStatusHistory')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'nvarchar', nullable: true })
  fromStatus: OrderStatus;

  @Column({ type: 'nvarchar' })
  toStatus: OrderStatus;

  @Column({ nullable: true, type: 'nvarchar', length: 'max' })
  comment: string;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
