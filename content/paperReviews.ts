export interface ReviewPoint { title: string; body: string }
export interface PaperReview {
  slug: string
  name: string
  title: string
  venue: string
  year: string
  authors: string
  lab: string
  theme: string
  description: string
  question: string
  takeaway: string
  stats: { value: string; label: string }[]
  summary: string[]
  strengths: ReviewPoint[]
  weaknesses: ReviewPoint[]
  suggestions: ReviewPoint[]
  sources: { title: string; url: string }[]
  reviewed: string
}

export const PAPER_REVIEWS: PaperReview[] = [
  {
    slug: "panoradar",
    name: "PanoRadar",
    title: "Enabling Visual Recognition at Radio Frequency",
    venue: "MobiCom",
    year: "2024",
    authors: "Haowen Lai, Gaoxiang Luo, Yifei Liu, Mingmin Zhao",
    lab: "University of Pennsylvania",
    theme: "Radar imaging",
    description: "A rotating radar chip turns radio reflections into a detailed view of a room.",
    question: "How much can a cheap radar see when optical sensors struggle?",
    takeaway: "The rotating antenna is the strongest idea here. I’d like to see radar used for what makes it different, rather than judged only by how closely it imitates lidar.",
    stats: [
      { value: "2.6°", label: "azimuth resolution" },
      { value: "15.8 cm", label: "mean range error" },
      { value: "12", label: "buildings evaluated" },
    ],
    summary: [
      "PanoRadar rotates a small radar chip to collect reflections from many positions. Signal processing combines these measurements into a sharper image, while motion estimation keeps the image coherent as the robot moves.",
      "A neural network improves the weaker vertical resolution using lidar images as training labels. The resulting depth maps support surface estimation, segmentation, and object detection. The authors evaluate the system across 12 buildings, holding out one building at a time.",
    ],
    strengths: [
      { title: "A simple hardware idea", body: "Rotation creates a much larger effective antenna array. That contribution remains useful even if a better model replaces the current network." },
      { title: "Movement is part of the design", body: "Estimating motion makes the synthetic aperture useful on a robot rather than only on a stationary rig." },
      { title: "A meaningful generalisation test", body: "Holding out entire buildings is more convincing than testing on new frames from familiar rooms." },
    ],
    weaknesses: [
      { title: "The average hides a long tail", body: "Median range error is 3.4 cm, but the mean is 15.8 cm and the 90th percentile is about 32 cm. Those differences matter when an obstacle is close." },
      { title: "Adverse conditions need stronger evidence", body: "Most results come from ordinary indoor settings. The work would be more persuasive with controlled smoke and fog tests." },
      { title: "Lidar supervision narrows the goal", body: "Learning to reproduce lidar images may leave useful radar information unexplored, including reflections that travel along indirect paths." },
    ],
    suggestions: [
      { title: "Show where errors happen", body: "Break down the error distribution by material, surface, and object class. Report speed and latency limits alongside accuracy." },
      { title: "Test the central promise", body: "Compare radar, cameras, and lidar in the same smoke or fog experiment." },
      { title: "Explore radar on its own terms", body: "Test whether indirect reflections and consistency across rotations can provide useful supervision beyond lidar labels." },
    ],
    sources: [
      { title: "Original paper", url: "https://arxiv.org/abs/2405.19516" },
      { title: "Code and dataset", url: "https://github.com/penn-waves-lab/PanoRadar" },
    ],
    reviewed: "2026-10-04",
  },
  {
    slug: "av-twin",
    name: "AV-Twin",
    title: "Building Audio-Visual Digital Twins with Smartphones",
    venue: "MobiSys",
    year: "2026",
    authors: "Zitong Lan, Yiwei Tang, Yuhan Wang, Haowen Lai, Yiduo Hao, Mingmin Zhao",
    lab: "University of Pennsylvania",
    theme: "Room acoustics",
    description: "Two phones capture a room’s acoustics and turn them into an editable digital twin.",
    question: "Can two phones make capturing room acoustics practical?",
    takeaway: "Editability makes this more interesting than a recording. The next step is to show who needs it and whether the method holds up beyond classrooms.",
    stats: [
      { value: "20 min", label: "walkthrough capture" },
      { value: "5.6%", label: "material reflectivity error" },
      { value: "88%", label: "listener preference in the study" },
    ],
    summary: [
      "Two people walk through a room with iPhones. One phone emits sound; the other records it. An acoustic handshake synchronises the devices, while phone lidar and SLAM estimate their positions and the room’s geometry.",
      "The room mesh guides acoustic reconstruction. A differentiable renderer estimates how each surface reflects sound, separating geometry from materials. Changing a wall or adding furniture can then update the simulated audio without capturing the room again.",
      "The authors report a 20-minute walkthrough, 5.6% material reflectivity error against their reference setup, and a listening study in which 88% of 17 participants preferred the walkthrough rendering.",
    ],
    strengths: [
      { title: "Accessible capture", body: "Commodity phones reduce the equipment needed to build an acoustic model. That could make data collection useful to more people." },
      { title: "A model that can be edited", body: "Separating surface properties from geometry supports design changes, rather than only replaying the room as it was captured." },
      { title: "Vision has a clear purpose", body: "The visual mesh limits acoustic sampling to surfaces and helps group materials, reducing the reconstruction problem." },
    ],
    weaknesses: [
      { title: "Limited room variety", body: "The evaluation covers four classrooms on one campus. Homes, soft furnishings, and large halls could behave differently." },
      { title: "Appearance can mislead the model", body: "Visually similar materials are grouped together, but painted brick and painted drywall can look alike while sounding different." },
      { title: "The reference needs scrutiny", body: "Material estimates should also be checked against independent acoustic measurements. Capture time alone does not establish an advantage over a smaller, matched grid." },
    ],
    suggestions: [
      { title: "Challenge the material assumption", body: "Test surfaces that look similar but have different acoustic properties, and report when grouping fails." },
      { title: "Make the comparison fair", body: "Compare a walkthrough and a fixed grid with the same number of recordings. Validate edits against recordings of a physically changed room." },
      { title: "Design around a specific user", body: "Try a home, a furnished office, and a hall. Explore whether one person with a phone and speaker can capture enough data for acoustic design or spatial audio." },
    ],
    sources: [
      { title: "Original paper", url: "https://arxiv.org/abs/2512.10778" },
      { title: "Project and demonstrations", url: "https://waves.seas.upenn.edu/projects/av-twin/" },
    ],
    reviewed: "2026-10-04",
  },
  {
    slug: "mmnorm",
    name: "mmNorm",
    title: "Non-Line-of-Sight 3D Object Reconstruction via mmWave Surface Normal Estimation",
    venue: "MobiSys",
    year: "2025",
    authors: "Laura Dodds, Tara Boroushaki, Kaichen Zhou, Fadel Adib",
    lab: "MIT Signal Kinetics",
    theme: "Hidden geometry",
    description: "Radar reflections reveal the surface of an object hidden inside a box.",
    question: "Can radar recover useful shape information through a closed box?",
    takeaway: "The physics gives a precise but incomplete view. I’d start with a task that needs only the visible surface, then test whether that evidence is enough for a reliable decision.",
    stats: [
      { value: "96%", label: "reported median 3D F-score" },
      { value: "0.6 cm", label: "median position error" },
      { value: "61", label: "objects evaluated" },
    ],
    summary: [
      "At millimetre wavelengths, many surfaces reflect like mirrors. A strong return at a particular antenna position gives a clue about which way the surface faces. mmNorm uses those clues to estimate surface normals and reconstruct geometry.",
      "The method integrates the normal field into candidate surfaces, then compares their simulated reflections with the measured signal. It uses signal processing and geometry rather than a trained shape model.",
      "A radar mounted on a robot arm scans a 60 by 45 cm aperture. Across 116 trials on 61 objects, the authors report a median 3D F-score of 96%, compared with 78% for the strongest baseline. Position error remains similar with and without cardboard occlusion.",
    ],
    strengths: [
      { title: "A useful physical insight", body: "Specular reflection becomes a source of shape information rather than simply a problem to remove." },
      { title: "No learned shape prior", body: "The method does not need training examples of the objects it reconstructs. That avoids one source of dependence on familiar shapes." },
      { title: "Occlusion is tested directly", body: "The paper compares objects in the open and behind cardboard, rather than treating hidden-object sensing as a future possibility." },
    ],
    weaknesses: [
      { title: "Precision is not coverage", body: "Surfaces that reflect away from the radar can be missing. The follow-up Wave-Former comparison reports 34% recall for mmNorm, under its own evaluation setup." },
      { title: "The scanning rig limits use", body: "A large aperture swept by a robot arm is practical in a lab, but not yet a handheld capture method." },
      { title: "Material and reference limits", body: "Metal occlusions and difficult geometry remain obstacles. A consumer depth camera also limits how confidently very small reconstruction errors can be measured." },
    ],
    suggestions: [
      { title: "Report what is missing", body: "Publish recall and coverage alongside precision, with clear examples of unseen surfaces." },
      { title: "Test smaller and multiple scans", body: "Measure how accuracy changes as the aperture shrinks. Compare one large sweep with several short views from different sides." },
      { title: "Start with a narrow task", body: "Test sealed-box item verification before assuming the reconstruction supports grasping. Validate against a more accurate reference on a subset of objects." },
    ],
    sources: [
      { title: "Original paper", url: "https://laura-dodds.github.io/papers/mmNorm.pdf" },
      { title: "Code and demonstration", url: "https://github.com/signalkinetics/mmNorm" },
    ],
    reviewed: "2026-10-11",
  },
  {
    slug: "wave-former",
    name: "Wave-Former",
    title: "Wave-Former: Through-Occlusion 3D Reconstruction via Wireless Shape Completion",
    venue: "CVPR",
    year: "2026",
    authors: "Laura Dodds, Maisy Lam, Waleed Akbar, Yibo Cheng, Fadel Adib",
    lab: "MIT Signal Kinetics",
    theme: "Shape completion",
    description: "A model trained on simulated radar fills in the geometry the sensor cannot see.",
    question: "What can a learned shape prior add to an incomplete radar scan?",
    takeaway: "More complete geometry can help, but measured surfaces and inferred surfaces carry different kinds of evidence. I’d want that distinction visible before using the output to plan an action.",
    stats: [
      { value: "72%", label: "recall, compared with 34% for mmNorm" },
      { value: "0.069", label: "reported Chamfer distance" },
      { value: "0", label: "real radar scans used for training" },
    ],
    summary: [
      "Wave-Former builds on mmNorm’s partial surfaces. It trains a shape-completion model on simulated radar observations of more than 25,000 objects, removing points that would not reflect toward the radar and adding noise.",
      "At inference, the system completes several candidate surfaces and selects an answer using reflection consistency or geometric entropy. The reported results use real radar measurements even though training uses no real radar scans.",
      "In the paper’s comparison, recall rises from 34% to 72% and Chamfer distance falls from 0.214 to 0.069. Precision falls from 89% to 85%. These figures belong to that comparison and should not be mixed with mmNorm’s headline results under a different setup.",
    ],
    strengths: [
      { title: "Synthetic data transfers to real measurements", body: "The model learns from simulated partial shapes and is evaluated on a real radar. This reduces the need to collect a large training set with the sensor." },
      { title: "The data carries the physics", body: "The main contribution is adapting training observations to radar rather than introducing a completely new model architecture." },
      { title: "Several hypotheses stay alive", body: "Completing multiple candidate surfaces postpones a decision that would otherwise be made from incomplete evidence." },
    ],
    weaknesses: [
      { title: "Unseen geometry is inferred", body: "The model predicts the back of an object from learned patterns. A plausible completion may still be wrong for an unfamiliar shape." },
      { title: "Generality needs a harder test", body: "The evaluation uses the same 61 objects as mmNorm. A held-out object category would better test whether the method handles unfamiliar geometry." },
      { title: "Coverage comes with a tradeoff", body: "Recall improves while precision drops. For manipulation, adding an incorrect surface can matter as much as recovering a missing one. The robot-arm scan also remains a practical constraint." },
    ],
    suggestions: [
      { title: "Separate observation from inference", body: "Label measured and completed points separately, and expose uncertainty where possible. This would help downstream systems interpret the reconstruction." },
      { title: "Test unfamiliar shapes", body: "Hold out entire categories and try hidden handles, cavities, and unusual geometry. Report front-surface and back-surface errors separately." },
      { title: "Measure practical value", body: "Test whether completion improves a specific planning task. Compare synthetic-only training with a small amount of real data and explore a smaller scanning rig." },
    ],
    sources: [
      { title: "Original paper", url: "https://arxiv.org/abs/2511.14152" },
      { title: "CVPR publication", url: "https://openaccess.thecvf.com/content/CVPR2026/html/Dodds_Wave-Former_Through-Occlusion_3D_Reconstruction_via_Wireless_Shape_Completion_CVPR_2026_paper.html" },
      { title: "Related review: mmNorm", url: "/exploration/paper-review/mmnorm" },
    ],
    reviewed: "2026-10-11",
  },
]

export function getPaperReview(slug: string) {
  return PAPER_REVIEWS.find(paper => paper.slug === slug)
}
