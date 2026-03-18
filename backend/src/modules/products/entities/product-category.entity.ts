import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('ProductCategories')
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  parentId: string;

  @ManyToOne(() => ProductCategory, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: ProductCategory;

  @OneToMany(() => ProductCategory, (category) => category.parent)
  children: ProductCategory[];

  /** Products belonging to this category */
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
