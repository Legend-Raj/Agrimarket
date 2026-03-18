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
import { User } from '../../users/entities/user.entity';
import { ProductCategory } from './product-category.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { ProductStatus } from '../../../common/enums';

@Entity('Products')
@Index(['sellerId', 'isActive'])
@Index(['categoryId'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ default: 1 })
  minimumQuantity: number;

  @Column({ type: 'int', default: 50 })
  deliveryRadius: number;

  @Column({ type: 'nvarchar', default: ProductStatus.ACTIVE })
  status: ProductStatus;

  @Column({ nullable: true })
  sku: string;

  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => ProductCategory, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory;

  @Column()
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @Column({ nullable: true })
  primaryImageUrl: string;

  @OneToOne(() => Inventory, (inventory) => inventory.product, { nullable: true })
  inventory: Inventory;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
