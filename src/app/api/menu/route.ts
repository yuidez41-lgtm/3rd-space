import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { MenuItem } from "@/models/MenuItem";

const HARDCODED_MENU = [
  {
    _id: "hardcoded-1",
    name: "Espresso",
    description: "Rich and bold single shot",
    price: 85,
    category: "Coffee",
    image: "/menu/coffee/espresso.jpg",
    available: true,
  },
  {
    _id: "hardcoded-2",
    name: "Cappuccino",
    description: "Espresso with steamed milk and foam",
    price: 120,
    category: "Coffee",
    image: "/menu/coffee/cappuccino.jpg",
    available: true,
  },
  {
    _id: "hardcoded-3",
    name: "Latte",
    description: "Smooth espresso and velvety milk",
    price: 130,
    category: "Coffee",
    image: "/menu/coffee/latte.jpg",
    available: true,
  },
  {
    _id: "hardcoded-4",
    name: "Iced Americano",
    description: "Cold espresso with water and ice",
    price: 95,
    category: "Coffee",
    image: "/menu/coffee/iced-americano.jpg",
    available: true,
  },
  {
    _id: "hardcoded-5",
    name: "Flat White",
    description: "Espresso with microfoam milk",
    price: 125,
    category: "Coffee",
    image: "/menu/coffee/flat-white.jpg",
    available: true,
  },
  {
    _id: "hardcoded-6",
    name: "Matcha Latte",
    description: "Creamy matcha with steamed milk",
    price: 140,
    category: "Tea",
    image: "/menu/coffee/matcha-latte.jpg",
    available: true,
  },
  {
    _id: "hardcoded-7",
    name: "Oolong Tea",
    description: "Traditional oolong brew",
    price: 75,
    category: "Tea",
    image: "/menu/coffee/oolong-tea.jpg",
    available: true,
  },
  {
    _id: "hardcoded-8",
    name: "Croissant",
    description: "Buttery and flaky pastry",
    price: 65,
    category: "Pastry",
    image: "/menu/pastries/croissant.jpg",
    available: true,
  },
  {
    _id: "hardcoded-9",
    name: "Chocolate Cake",
    description: "Rich chocolate slice",
    price: 95,
    category: "Pastry",
    image: "/menu/pastries/chocolate-cake.jpg",
    available: true,
  },
  {
    _id: "hardcoded-10",
    name: "Blueberry Muffin",
    description: "Soft muffin with fresh blueberries",
    price: 75,
    category: "Pastry",
    image: "/menu/pastries/blueberry-muffin.jpg",
    available: true,
  },
  {
    _id: "hardcoded-11",
    name: "Cheesecake",
    description: "Creamy New York style cheesecake",
    price: 110,
    category: "Pastry",
    image: "/menu/pastries/cheesecake.jpg",
    available: true,
  },
  {
    _id: "hardcoded-12",
    name: "Sandwich",
    description: "Fresh turkey and cheese",
    price: 150,
    category: "Food",
    image: "/menu/food/sandwich.jpg",
    available: true,
  },
  {
    _id: "hardcoded-13",
    name: "Caesar Salad",
    description: "Crisp romaine with parmesan and croutons",
    price: 145,
    category: "Food",
    image: "/menu/food/caesar-salad.jpg",
    available: true,
  },
  {
    _id: "hardcoded-14",
    name: "Pasta Carbonara",
    description: "Classic Italian pasta with bacon and cream",
    price: 180,
    category: "Food",
    image: "/menu/food/pasta-carbonara.jpg",
    available: true,
  },
  {
    _id: "hardcoded-15",
    name: "Grilled Chicken",
    description: "Herb-marinated grilled chicken breast",
    price: 195,
    category: "Food",
    image: "/menu/food/grilled-chicken.jpg",
    available: true,
  },
];

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    const items = await MenuItem.find().sort({ category: 1, createdAt: 1 });
    if (items.length === 0) return NextResponse.json(HARDCODED_MENU);
    return NextResponse.json(items);
  } catch (error) {
    console.error("Menu GET error:", error);
    return NextResponse.json(HARDCODED_MENU);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    if (
      !body.name?.trim() ||
      !body.category?.trim() ||
      body.price === undefined ||
      body.price === null
    ) {
      return NextResponse.json(
        { error: "name, category, and price are required" },
        { status: 400 },
      );
    }
    const item = await MenuItem.create(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Menu POST error:", error);
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 },
    );
  }
}
