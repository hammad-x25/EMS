import { Difficulty, Prisma, PrismaClient, QuestionType, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

type QuestionSeed = {
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  options?: Array<{ id: string; text: string }>;
  correctIds?: string[];
  maxMarks: number;
  explanation?: string;
};

const questions: QuestionSeed[] = [
  { topic: "Algorithms", difficulty: "EASY", type: "SINGLE_MCQ", prompt: "Which data structure follows first-in, first-out order?", options: [{ id: "a", text: "Stack" }, { id: "b", text: "Queue" }, { id: "c", text: "Heap" }, { id: "d", text: "Tree" }], correctIds: ["b"], maxMarks: 2, explanation: "A queue removes items in the order they were inserted." },
  { topic: "Algorithms", difficulty: "EASY", type: "MULTI_SELECT", prompt: "Which sorting algorithms have O(n log n) average-case time complexity?", options: [{ id: "a", text: "Merge sort" }, { id: "b", text: "Quick sort" }, { id: "c", text: "Bubble sort" }, { id: "d", text: "Selection sort" }], correctIds: ["a", "b"], maxMarks: 3 },
  { topic: "Algorithms", difficulty: "EASY", type: "WRITTEN", prompt: "Explain the difference between a stack and a queue using one real-world example for each.", maxMarks: 4 },
  { topic: "Algorithms", difficulty: "MEDIUM", type: "SINGLE_MCQ", prompt: "What is the time complexity of binary search on a sorted array?", options: [{ id: "a", text: "O(1)" }, { id: "b", text: "O(log n)" }, { id: "c", text: "O(n)" }, { id: "d", text: "O(n log n)" }], correctIds: ["b"], maxMarks: 2 },
  { topic: "Algorithms", difficulty: "MEDIUM", type: "MULTI_SELECT", prompt: "Which techniques can solve shortest-path problems?", options: [{ id: "a", text: "Breadth-first search for unweighted graphs" }, { id: "b", text: "Dijkstra's algorithm for non-negative weights" }, { id: "c", text: "Binary search" }, { id: "d", text: "Bellman-Ford algorithm" }], correctIds: ["a", "b", "d"], maxMarks: 4 },
  { topic: "Algorithms", difficulty: "MEDIUM", type: "WRITTEN", prompt: "Describe how divide-and-conquer is used by merge sort.", maxMarks: 5 },
  { topic: "Algorithms", difficulty: "HARD", type: "SINGLE_MCQ", prompt: "Which problem is classically NP-complete?", options: [{ id: "a", text: "Array lookup" }, { id: "b", text: "Minimum spanning tree" }, { id: "c", text: "Boolean satisfiability" }, { id: "d", text: "Single-source shortest path" }], correctIds: ["c"], maxMarks: 3 },
  { topic: "Algorithms", difficulty: "HARD", type: "WRITTEN", prompt: "Propose a dynamic-programming recurrence for the 0/1 knapsack problem and state its complexity.", maxMarks: 6 },

  { topic: "Databases", difficulty: "EASY", type: "SINGLE_MCQ", prompt: "Which SQL statement retrieves rows from a table?", options: [{ id: "a", text: "SELECT" }, { id: "b", text: "UPDATE" }, { id: "c", text: "DELETE" }, { id: "d", text: "ALTER" }], correctIds: ["a"], maxMarks: 2 },
  { topic: "Databases", difficulty: "EASY", type: "MULTI_SELECT", prompt: "Which are common relational database constraints?", options: [{ id: "a", text: "PRIMARY KEY" }, { id: "b", text: "FOREIGN KEY" }, { id: "c", text: "UNIQUE" }, { id: "d", text: "RENDER" }], correctIds: ["a", "b", "c"], maxMarks: 3 },
  { topic: "Databases", difficulty: "EASY", type: "WRITTEN", prompt: "What is a primary key, and why must it be unique?", maxMarks: 4 },
  { topic: "Databases", difficulty: "MEDIUM", type: "SINGLE_MCQ", prompt: "Which normal form removes partial dependency on a composite key?", options: [{ id: "a", text: "First normal form" }, { id: "b", text: "Second normal form" }, { id: "c", text: "Third normal form" }, { id: "d", text: "Boyce-Codd normal form" }], correctIds: ["b"], maxMarks: 2 },
  { topic: "Databases", difficulty: "MEDIUM", type: "MULTI_SELECT", prompt: "Which ACID properties concern correctness during transactions?", options: [{ id: "a", text: "Atomicity" }, { id: "b", text: "Consistency" }, { id: "c", text: "Isolation" }, { id: "d", text: "Durability" }], correctIds: ["a", "b", "c", "d"], maxMarks: 4 },
  { topic: "Databases", difficulty: "MEDIUM", type: "WRITTEN", prompt: "Explain how an index can improve reads while increasing write cost.", maxMarks: 5 },
  { topic: "Databases", difficulty: "HARD", type: "SINGLE_MCQ", prompt: "Under snapshot isolation, which anomaly may still occur?", options: [{ id: "a", text: "Dirty read" }, { id: "b", text: "Write skew" }, { id: "c", text: "Torn page" }, { id: "d", text: "Syntax error" }], correctIds: ["b"], maxMarks: 3 },
  { topic: "Databases", difficulty: "HARD", type: "WRITTEN", prompt: "Compare optimistic and pessimistic concurrency control for a high-contention workload.", maxMarks: 6 },

  { topic: "Networks", difficulty: "EASY", type: "SINGLE_MCQ", prompt: "Which protocol translates domain names into IP addresses?", options: [{ id: "a", text: "DNS" }, { id: "b", text: "SMTP" }, { id: "c", text: "SSH" }, { id: "d", text: "NTP" }], correctIds: ["a"], maxMarks: 2 },
  { topic: "Networks", difficulty: "EASY", type: "MULTI_SELECT", prompt: "Which protocols commonly operate at the transport layer?", options: [{ id: "a", text: "TCP" }, { id: "b", text: "UDP" }, { id: "c", text: "HTTP" }, { id: "d", text: "Ethernet" }], correctIds: ["a", "b"], maxMarks: 3 },
  { topic: "Networks", difficulty: "EASY", type: "WRITTEN", prompt: "State one difference between a router and a switch.", maxMarks: 4 },
  { topic: "Networks", difficulty: "MEDIUM", type: "SINGLE_MCQ", prompt: "How many usable host addresses are normally available in an IPv4 /24 subnet?", options: [{ id: "a", text: "128" }, { id: "b", text: "254" }, { id: "c", text: "256" }, { id: "d", text: "510" }], correctIds: ["b"], maxMarks: 2 },
  { topic: "Networks", difficulty: "MEDIUM", type: "MULTI_SELECT", prompt: "Which mechanisms help make HTTP communication secure?", options: [{ id: "a", text: "TLS encryption" }, { id: "b", text: "Certificate validation" }, { id: "c", text: "Plain-text credentials" }, { id: "d", text: "Integrity checks" }], correctIds: ["a", "b", "d"], maxMarks: 4 },
  { topic: "Networks", difficulty: "MEDIUM", type: "WRITTEN", prompt: "Describe the TCP three-way handshake.", maxMarks: 5 },
  { topic: "Networks", difficulty: "HARD", type: "SINGLE_MCQ", prompt: "Which routing protocol uses a link-state algorithm?", options: [{ id: "a", text: "RIP" }, { id: "b", text: "OSPF" }, { id: "c", text: "ARP" }, { id: "d", text: "DHCP" }], correctIds: ["b"], maxMarks: 3 },
  { topic: "Networks", difficulty: "HARD", type: "WRITTEN", prompt: "Explain how congestion control differs from flow control in TCP.", maxMarks: 6 },
];

async function upsertUser(input: { id: string; email: string; name: string; password: string; role: Role; studentId?: string }) {
  const passwordHash = await hash(input.password, 10);
  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, passwordHash, role: input.role, studentId: input.studentId, isActive: true },
    create: { id: input.id, email: input.email, name: input.name, passwordHash, role: input.role, studentId: input.studentId },
  });
}

async function main() {
  await upsertUser({ id: "seed-admin", email: "admin@aegisexam.local", name: "Aegis Administrator", password: "Admin@123!", role: "ADMIN" });
  const examiner = await upsertUser({ id: "seed-examiner-1", email: "examiner1@aegisexam.local", name: "Dr. Amina Khan", password: "Examiner@123!", role: "EXAMINER" });
  await upsertUser({ id: "seed-examiner-2", email: "examiner2@aegisexam.local", name: "Prof. Bilal Ahmed", password: "Examiner@123!", role: "EXAMINER" });

  for (let index = 1; index <= 5; index += 1) {
    await upsertUser({
      id: `seed-candidate-${index}`,
      email: `candidate${index}@aegisexam.local`,
      name: `Demo Candidate ${index}`,
      password: "Candidate@123!",
      role: "CANDIDATE",
      studentId: `AEG-2026-${String(index).padStart(3, "0")}`,
    });
  }

  for (const [index, question] of questions.entries()) {
    const id = `seed-question-${String(index + 1).padStart(2, "0")}`;
    const data = {
      topic: question.topic,
      difficulty: question.difficulty,
      type: question.type,
      prompt: question.prompt,
      optionsJson: question.options ? (question.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      correctIdsJson: question.correctIds ? (question.correctIds as Prisma.InputJsonValue) : Prisma.JsonNull,
      maxMarks: question.maxMarks,
      explanation: question.explanation,
      createdById: examiner.id,
    };
    await prisma.question.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  console.info(`Seeded 8 users and ${questions.length} reusable questions.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
