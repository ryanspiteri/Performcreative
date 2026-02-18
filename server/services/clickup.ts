import axios from "axios";
import { ENV } from "../_core/env";

const clickupClient = axios.create({
  baseURL: "https://api.clickup.com/api/v2",
  headers: {
    Authorization: ENV.clickupApiKey,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

export interface ClickUpTask {
  id: string;
  name: string;
  url: string;
  status: string;
}

// Find the VIDEO AD BOARD list and SCRIPT REVIEW status
async function findVideoAdBoardList(): Promise<{ listId: string; statusName: string }> {
  try {
    // Get teams/workspaces
    const teamsRes = await clickupClient.get("/team");
    const teams = teamsRes.data?.teams || [];
    
    if (teams.length === 0) {
      throw new Error("No ClickUp teams found");
    }

    const teamId = teams[0].id;

    // Get spaces
    const spacesRes = await clickupClient.get(`/team/${teamId}/space`);
    const spaces = spacesRes.data?.spaces || [];

    for (const space of spaces) {
      // Get folders in space
      const foldersRes = await clickupClient.get(`/space/${space.id}/folder`);
      const folders = foldersRes.data?.folders || [];

      for (const folder of folders) {
        // Get lists in folder
        const listsRes = await clickupClient.get(`/folder/${folder.id}/list`);
        const lists = listsRes.data?.lists || [];

        for (const list of lists) {
          if (list.name?.toUpperCase().includes("VIDEO AD BOARD") || 
              list.name?.toUpperCase().includes("VIDEO_AD_BOARD")) {
            return { listId: list.id, statusName: "SCRIPT REVIEW" };
          }
        }
      }

      // Also check folderless lists
      const folderlessRes = await clickupClient.get(`/space/${space.id}/list`);
      const folderlessLists = folderlessRes.data?.lists || [];
      
      for (const list of folderlessLists) {
        if (list.name?.toUpperCase().includes("VIDEO AD BOARD") ||
            list.name?.toUpperCase().includes("VIDEO_AD_BOARD")) {
          return { listId: list.id, statusName: "SCRIPT REVIEW" };
        }
      }
    }

    // If not found, use the first available list
    if (spaces.length > 0) {
      const foldersRes = await clickupClient.get(`/space/${spaces[0].id}/folder`);
      const folders = foldersRes.data?.folders || [];
      if (folders.length > 0) {
        const listsRes = await clickupClient.get(`/folder/${folders[0].id}/list`);
        const lists = listsRes.data?.lists || [];
        if (lists.length > 0) {
          return { listId: lists[0].id, statusName: "to do" };
        }
      }
      // Folderless
      const folderlessRes = await clickupClient.get(`/space/${spaces[0].id}/list`);
      const folderlessLists = folderlessRes.data?.lists || [];
      if (folderlessLists.length > 0) {
        return { listId: folderlessLists[0].id, statusName: "to do" };
      }
    }

    throw new Error("No suitable ClickUp list found");
  } catch (error: any) {
    console.error("[ClickUp] Error finding list:", error?.response?.data || error.message);
    throw error;
  }
}

export async function createScriptTask(
  scriptTitle: string,
  scriptType: string,
  score: number,
  scriptContent: string,
  product: string,
  priority: string
): Promise<ClickUpTask> {
  try {
    const { listId, statusName } = await findVideoAdBoardList();

    const taskName = `${scriptTitle} - ${scriptType}`;
    const description = `**Script Type:** ${scriptType}\n**Product:** ${product}\n**Priority:** ${priority}\n**Expert Review Score:** ${score}/100\n\n---\n\n${scriptContent}`;

    const priorityMap: Record<string, number> = {
      Urgent: 1,
      High: 2,
      Medium: 3,
      Low: 4,
    };

    const res = await clickupClient.post(`/list/${listId}/task`, {
      name: taskName,
      description,
      status: statusName,
      priority: priorityMap[priority] || 3,
      tags: [scriptType, product, "pipeline-generated"],
    });

    return {
      id: res.data.id,
      name: res.data.name,
      url: res.data.url,
      status: res.data.status?.status || statusName,
    };
  } catch (error: any) {
    console.error("[ClickUp] Error creating task:", error?.response?.data || error.message);
    // Return a placeholder if ClickUp fails
    return {
      id: `pending-${Date.now()}`,
      name: `${scriptTitle} - ${scriptType}`,
      url: "#",
      status: "pending",
    };
  }
}

export async function createMultipleScriptTasks(
  scripts: Array<{
    title: string;
    type: string;
    score: number;
    content: string;
  }>,
  product: string,
  priority: string
): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];
  for (const script of scripts) {
    const task = await createScriptTask(
      script.title,
      script.type,
      script.score,
      script.content,
      product,
      priority
    );
    tasks.push(task);
  }
  return tasks;
}
