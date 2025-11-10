import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

const ELASTICSEARCH_URL = "http://elasticsearch:9200";
const INDEX_NAME = "posts";

const getPrismaClient = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  }).$extends(withAccelerate());
};

async function syncPostsToES() {
  console.log("Starting synchronization of posts to Elasticsearch...");
  const prisma = getPrismaClient();

  try {
    const allPosts = await prisma.post.findMany({
      include: {
        author: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`Found ${allPosts.length} posts to sync.`);
    if (allPosts.length === 0) {
      console.log("No posts to sync. Exiting.");
      return;
    }

    console.log("Creating NDJSON body for Elasticsearch Bulk API...");

    const ndjsonBody = allPosts.map(post => {
      const action = {
        index: { _index: INDEX_NAME, _id: post.id.toString() }
      };
      const document = {
        postId: post.id,
        title: post.title,
        body: post.body,
        authorName: post.author.name || 'Unknown',
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
      };
      return JSON.stringify(action) + '\n' + JSON.stringify(document);
    }).join('\n') + '\n';

    const res = await fetch(`${ELASTICSEARCH_URL}/_bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson'
      },
      body: ndjsonBody,
    });

    const result:any = await res.json();

    if (!res.ok || result.errors) {
      console.error("Bulk indexing failed. Response:", JSON.stringify(result, null, 2));
      throw new Error('Bulk indexing failed.');
    }

    console.log(`Successfully indexed ${result.items.length} documents.`);

  } catch (error) {
    console.error("An error occurred during synchronization:", error);
  } finally {
    await prisma.$disconnect();
    console.log("Synchronization process finished.");
  }
}

syncPostsToES();