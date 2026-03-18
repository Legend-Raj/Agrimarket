import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('Inventory')
@Index(['productId'], { unique: true })
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @OneToOne(() => Product, (product) => product.inventory)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  reservedQuantity: number;

  @Column({ type: 'int', default: 0 })
  availableQuantity: number;

  @Column({ type: 'int', nullable: true })
  lowStockThreshold: number;

  @Column({ type: 'int', nullable: true })
  reorderPoint: number;

  @Column({ default: true })
  trackQuantity: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
